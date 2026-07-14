import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
export { greatQuestionPoints } from "./greatQuestionRewardPolicy";

const ScenarioSchema = z.object({ scenario: z.string().min(20).max(500), opening: z.string().min(10).max(500) });
const ReplySchema = z.object({ relevant: z.boolean(), readyToEvaluate: z.boolean(), reply: z.string().min(1).max(700) });
export const GreatQuestionEvaluationSchema = z.object({
  relevant: z.boolean(), curiosityScore: z.number().int().min(0).max(2), depthScore: z.number().int().min(0).max(2),
  originalityScore: z.number().int().min(0).max(2), clarityScore: z.number().int().min(0).max(2), reason: z.string().min(1).max(400),
  greatQuestion: z.string().min(2).max(240), questionTitle: z.string().min(2).max(40),
});

async function jsonCompletion<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const response = await openai.chat.completions.create({
    model: process.env.READING_AI_MODEL ?? "gpt-5-mini", max_completion_tokens: 3000,
    messages: [{ role: "user", content: `${prompt}\n반드시 JSON만 답하세요.` }],
  });
  const raw = response.choices[0]?.message?.content ?? "";
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("위대한 질문 AI 응답을 읽지 못했습니다.");
  return schema.parse(JSON.parse(json));
}

export async function createDailyScenario(params: { age: number; domainLabel: string; recentScenarios: string[] }) {
  return jsonCompletion(
    `당신은 아이의 질문력을 키우는 코치입니다. ${params.age}세 아이가 선택한 관심 분야는 '${params.domainLabel}'입니다.
직업을 고르게 하지 말고, 아이가 호기심을 느낄 생활 속 문제나 상상 상황 하나를 주세요. 어려운 사회 문제를 길게 설명하지 마세요.
최근 상황과 겹치지 않게 하세요: ${params.recentScenarios.join(" | ") || "없음"}
scenario는 ${params.age}세 아이가 한 번에 이해할 수 있는 쉬운 한국어 2~3문장으로 쓰세요.
opening은 상황을 다시 요약하지 말고 '여기서 무엇이 제일 궁금해?'처럼 편하게 첫 궁금증을 말하도록 다정하게 유도하세요.
JSON 형식: {"scenario":"오늘의 상황","opening":"아이에게 보낼 첫 메시지"}`,
    ScenarioSchema,
  );
}

export async function createGreatQuestionReply(params: { age: number; domainLabel: string; scenario: string; messages: { role: "child" | "assistant"; content: string }[] }) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `당신은 ${params.age}세 아이의 질문력을 키우는 코치입니다. 분야: ${params.domainLabel}. 오늘 상황: ${params.scenario}
대화:\n${transcript}
당신의 역할은 질문을 검사하거나 고치는 선생님이 아니라 아이와 함께 궁금해하는 이야기 친구입니다.
아이의 마지막 말이 상황과 관련 있는지 판단하세요. 관련 없으면 relevant=false로 하되 혼내지 말고 오늘 이야기로 자연스럽게 돌아오게 하세요.
관련 있으면 반드시 먼저 아이의 질문이나 생각에 쉬운 말로 2~3문장 답하세요. 정답만 말하지 말고 신기한 사실, 역사 속 작은 이야기, 또는 짧은 상상을 하나 더해 다음 호기심의 재료를 주세요.
그 다음에는 질문을 다시 쓰라고 명령하지 말고, '어느 쪽이 더 궁금해?'처럼 쉬운 선택 2개 또는 짧은 후속 질문 1개만 건네세요.
아이가 '어려워', '모르겠어'라고 하면 설명을 더 쉽게 줄이고 선택지 2개를 주세요.
'누구/기간/변화 요소', '관점', '한 문장으로 다시 만들어' 같은 평가·수업 용어를 절대 쓰지 마세요.
아이가 당연한 것을 다시 묻거나, 더 좋은 세상을 상상하거나, '만약/어떻게 하면/꼭 그래야 할까'처럼 가능성을 여는 자기 질문을 했다면 문장이 완벽하지 않아도 readyToEvaluate=true로 하세요.
답은 ${params.age}세 아이가 읽기 쉬운 따뜻한 한국어로 220자 안팎으로 쓰세요.
JSON 형식: {"relevant":true,"readyToEvaluate":false,"reply":"코치 답변"}`,
    ReplySchema,
  );
}

export async function evaluateGreatQuestion(params: { age: number; domainLabel: string; scenario: string; messages: { role: "child" | "assistant"; content: string }[] }) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `당신은 아이의 질문을 공정하게 평가하는 코치입니다. ${params.age}세, 분야: ${params.domainLabel}, 상황: ${params.scenario}\n대화:\n${transcript}
상황과 무관하거나 질문이 없거나 장난/무의미한 반복이면 relevant=false이고 모든 점수는 0입니다.
대화 전체에서 아이가 직접 말한 가장 좋은 질문을 찾으세요. 문법보다 세상의 문제 발견, 당연한 것 다시 묻기, 새로운 가능성 상상, 다른 사람을 더 좋게 만드는 생각을 중요하게 평가하세요.
각 0~2점: 호기심(curiosity), 깊이(depth), 새로운 가능성(originality), 아이 생각이 드러나는 정도(clarity). 어려운 단어를 썼다고 점수를 더 주지 마세요.
greatQuestion은 아이의 뜻을 바꾸지 말고 가장 좋은 질문을 자연스러운 한 문장으로만 가볍게 정리하세요. questionTitle은 아이가 좋아할 짧은 제목으로 만드세요.
reason은 점수 용어를 나열하지 말고, 이 질문이 어떤 새로운 생각의 문을 열었는지 쉬운 말 2문장으로 설명하세요.
JSON 형식: {"relevant":true,"curiosityScore":0,"depthScore":0,"originalityScore":0,"clarityScore":0,"reason":"...","greatQuestion":"아이의 위대한 질문","questionTitle":"짧은 제목"}`,
    GreatQuestionEvaluationSchema,
  );
}
