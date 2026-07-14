import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
export { greatQuestionPoints } from "./greatQuestionRewardPolicy";

const ScenarioSchema = z.object({ scenario: z.string().min(20).max(500), opening: z.string().min(10).max(500) });
const ReplySchema = z.object({
  relevant: z.boolean(),
  questionKind: z.enum(["exploring", "change", "off_topic"]),
  readyToEvaluate: z.boolean(),
  reply: z.string().min(1).max(700),
});
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
opening은 상황을 다시 요약하거나 '무엇이 궁금해?'라고 묻지 마세요. '이 상황을 더 좋게 바꾸려면, 어떤 질문을 해보면 좋을까?'라고 바로 물으세요. 아이에게 문제를 다시 고르게 하지 마세요. 답이 막히면 '어떻게 하면 …할 수 있을까?', '꼭 지금처럼 해야 할까?', '…할 수 없을까?'처럼 시작해도 된다고 가볍게 도와주세요.
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
대화 전체가 아니라 반드시 아이의 마지막 말만 보고 다음 세 종류 중 하나로 구분하세요.
1) exploring: '왜 금속은 뜨거워?'처럼 이미 있는 사실이나 원리를 알고 싶은 탐색 질문
2) change: '뜨거워지지 않는 놀이터를 어떻게 만들까?'처럼 더 좋은 상황과 새로운 가능성을 만드는 변화 질문
3) off_topic: 오늘 상황과 관계없는 말
off_topic이면 relevant=false로 하되 혼내지 말고 오늘 이야기로 자연스럽게 돌아오게 하세요.
exploring이면 relevant=true입니다. 질문에 쉬운 말로 2~3문장 답해 생각의 재료를 주고, '좋은 탐색이야. 이제 이 사실을 이용해서 이 상황을 바꾸는 질문을 하나 만들어 볼까?'처럼 변화 질문으로 연결하세요. 탐색 질문이 나쁘거나 부족하다고 말하지 마세요.
아이의 말이 생각이나 의견이면 그것도 존중해서 받고, 그 생각을 바탕으로 이 상황을 바꾸는 질문을 함께 만들어 주세요.
change이면 relevant=true입니다. 그 질문이 어떤 더 좋은 세상을 열 수 있는지 짧게 이야기하고, 필요한 경우에만 한 단계 더 넓은 가능성을 상상하게 하세요.
대화는 '이 상황을 바꾸려면 어떤 질문이 좋을지 생각하기 → 필요한 사실 살펴보기 → 더 좋은 세상을 여는 질문으로 넓히기' 순서를 따르되, 이미 아이가 한 단계를 말했다면 반복시키지 마세요.
그 다음에는 질문을 다시 쓰라고 명령하지 말고, 아이가 고를 수 있는 변화 방향 2개 또는 짧은 후속 질문 1개만 건네세요.
아이가 '어려워', '모르겠어'라고 하면 설명을 더 쉽게 줄이고 선택지 2개를 주세요.
'누구/기간/변화 요소', '관점', '한 문장으로 다시 만들어' 같은 평가·수업 용어를 절대 쓰지 마세요.
단순히 사실의 답을 묻는 exploring 질문만 있을 때는 readyToEvaluate=false입니다.
아이가 바꾸고 싶은 문제와 더 좋은 모습을 담아 '만약/어떻게 하면/꼭 그래야 할까/할 수 없을까'처럼 가능성을 여는 자기 change 질문을 했다면 문장이 완벽하지 않아도 readyToEvaluate=true로 하세요.
'새로운 방법을 어떻게 만들 수 있을까?', '힘든 사람이 없게 할 수 없을까?'처럼 구체적인 해결책이 아직 없어도 변화를 만들려는 열린 질문은 change입니다.
답은 ${params.age}세 아이가 읽기 쉬운 따뜻한 한국어로 220자 안팎으로 쓰세요.
JSON 형식: {"relevant":true,"questionKind":"exploring","readyToEvaluate":false,"reply":"코치 답변"}`,
    ReplySchema,
  );
}

export async function evaluateGreatQuestion(params: { age: number; domainLabel: string; scenario: string; messages: { role: "child" | "assistant"; content: string }[] }) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `당신은 아이의 질문을 공정하게 평가하는 코치입니다. ${params.age}세, 분야: ${params.domainLabel}, 상황: ${params.scenario}\n대화:\n${transcript}
상황과 무관하거나 질문이 없거나 장난/무의미한 반복이면 relevant=false이고 모든 점수는 0입니다.
사실이나 원리의 답만 묻는 탐색 질문만 있고 상황을 더 좋게 바꾸는 질문이 없다면 relevant=false이고 모든 점수는 0입니다. reason에는 탐색 질문으로 좋은 재료를 찾았으며 이제 무엇을 바꿀지 생각해 보자고 다정하게 설명하세요.
대화 전체에서 아이가 직접 말한 가장 좋은 변화 질문을 찾으세요. 문법보다 세상의 문제 발견, 해결된 모습 상상, 당연한 것 다시 묻기, 새로운 가능성, 다른 사람을 더 좋게 만드는 생각을 중요하게 평가하세요.
각 0~2점: 호기심(curiosity), 깊이(depth), 새로운 가능성(originality), 아이 생각이 드러나는 정도(clarity). 어려운 단어를 썼다고 점수를 더 주지 마세요.
greatQuestion은 아이의 뜻을 바꾸지 말고 가장 좋은 질문을 자연스러운 한 문장으로만 가볍게 정리하세요. questionTitle은 아이가 좋아할 짧은 제목으로 만드세요.
reason은 점수 용어를 나열하지 말고, 이 질문이 어떤 새로운 생각의 문을 열었는지 쉬운 말 2문장으로 설명하세요.
예: '하늘은 왜 파래?'는 탐색 질문이고, '사람도 새처럼 하늘을 날 수 없을까?'는 변화 질문입니다.
JSON 형식: {"relevant":true,"curiosityScore":0,"depthScore":0,"originalityScore":0,"clarityScore":0,"reason":"...","greatQuestion":"아이의 변화 질문","questionTitle":"짧은 제목"}`,
    GreatQuestionEvaluationSchema,
  );
}
