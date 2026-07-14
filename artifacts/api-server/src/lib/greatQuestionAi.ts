import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
export { greatQuestionPoints } from "./greatQuestionRewardPolicy";

const ScenarioSchema = z.object({
  scenario: z.string().min(20).max(500),
  opening: z.string().min(10).max(500),
});
const ReplySchema = z.object({
  relevant: z.boolean(),
  questionKind: z.enum(["exploring", "change", "off_topic"]),
  readyToEvaluate: z.boolean(),
  reply: z.string().min(1).max(700),
});
export const GreatQuestionEvaluationSchema = z.object({
  relevant: z.boolean(),
  curiosityScore: z.number().int().min(0).max(2),
  depthScore: z.number().int().min(0).max(2),
  originalityScore: z.number().int().min(0).max(2),
  clarityScore: z.number().int().min(0).max(2),
  reason: z.string().min(1).max(400),
  greatQuestion: z.string().min(2).max(240),
  questionTitle: z.string().min(2).max(40),
});

async function jsonCompletion<T>(
  prompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await openai.chat.completions.create({
    model: process.env.READING_AI_MODEL ?? "gpt-5-mini",
    max_completion_tokens: 3000,
    messages: [{ role: "user", content: `${prompt}\n반드시 JSON만 답하세요.` }],
  });
  const raw = response.choices[0]?.message?.content ?? "";
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("위대한 질문 AI 응답을 읽지 못했습니다.");
  return schema.parse(JSON.parse(json));
}

export async function createDailyScenario(params: {
  age: number;
  domainLabel: string;
  recentScenarios: string[];
}) {
  return jsonCompletion(
    `당신은 아이의 질문력을 키우는 코치입니다. ${params.age}세 아이가 선택한 관심 분야는 '${params.domainLabel}'입니다.
직업을 고르게 하지 말고, 아이가 호기심을 느낄 생활 속 문제나 상상 상황 하나를 주세요. 어려운 사회 문제를 길게 설명하지 마세요.
최근 상황과 겹치지 않게 하세요: ${params.recentScenarios.join(" | ") || "없음"}
scenario는 ${params.age}세 아이가 한 번에 이해할 수 있는 쉬운 한국어 2~3문장으로 쓰세요.
opening은 상황을 다시 요약하거나 아이에게 질문의 방향을 제시하지 마세요. '이 이야기를 읽고 떠오르는 질문이 있으면 자유롭게 물어봐.'처럼 짧고 열어 둔 말만 하세요. 질문 예시, 문장 틀, 선택지는 절대 주지 마세요.
JSON 형식: {"scenario":"오늘의 상황","opening":"아이에게 보낼 첫 메시지"}`,
    ScenarioSchema,
  );
}

export async function createGreatQuestionReply(params: {
  age: number;
  domainLabel: string;
  scenario: string;
  messages: { role: "child" | "assistant"; content: string }[];
}) {
  const transcript = params.messages
    .map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`)
    .join("\n");
  return jsonCompletion(
    `당신은 ${params.age}세 아이의 질문력을 키우는 코치입니다. 분야: ${params.domainLabel}. 오늘 상황: ${params.scenario}
대화:\n${transcript}
당신의 역할은 질문을 검사하거나 고치는 선생님이 아니라 아이와 함께 궁금해하는 이야기 친구입니다.
대화 기록을 읽고, 반드시 아이의 마지막 말에만 답하세요. 바로 앞 AI 답변을 되풀이하거나 비슷한 말로 다시 쓰지 마세요. 아이가 비슷한 질문을 이어서 해도 새로운 사실, 다른 예시 또는 다른 관점으로 답하세요.
대화 전체가 아니라 반드시 아이의 마지막 말만 보고 다음 세 종류 중 하나로 구분하세요.
1) exploring: '왜 금속은 뜨거워?'처럼 이미 있는 사실이나 원리를 알고 싶은 탐색 질문
2) change: '뜨거워지지 않는 놀이터를 어떻게 만들까?'처럼 더 좋은 상황과 새로운 가능성을 만드는 변화 질문
3) off_topic: 오늘 상황과 관계없는 말
off_topic이면 relevant=false로 하되 혼내지 말고 오늘 이야기로 자연스럽게 돌아오게 하세요.
exploring이면 relevant=true입니다. 질문에 쉬운 말로 2~3문장 답하고, 호기심이 이어질 만한 짧은 사실이나 이야기를 덧붙이세요. 탐색 질문이 나쁘거나 부족하다고 말하지 마세요. 답변 끝에 다음 질문, 질문의 틀, 해결 방법, 방향을 제안하지 마세요.
아이의 말이 생각이나 의견이면 그것을 존중하고 자연스럽게 대화하세요. 아이의 말을 질문으로 고쳐 쓰거나, 어떤 질문을 해야 한다고 안내하지 마세요.
change이면 relevant=true입니다. 그 질문이 품은 더 좋은 모습을 따뜻하게 이야기하되, 다음 단계나 더 넓은 질문을 제안하지 마세요. 대화가 끝났다고 말하지 말고, 아이가 계속 이야기할 수 있도록 열어 두세요.
대화는 아이가 먼저 고른 속도와 방향을 따릅니다. AI는 답하고 이야기를 나누지만, 질문 만들기 과제를 내거나 질문의 방향을 유도하지 않습니다.
아이에게 정답·해결책·방향을 고르게 하지 마세요. 번호가 붙은 선택지, 메뉴, '1) … 2) …' 형식, 질문 예시, 문장 틀은 절대 쓰지 마세요.
아이가 '어려워', '모르겠어'라고 하면 '천천히 생각해도 괜찮아.'처럼 부담을 덜어 주고 기다리세요. 질문 예시나 시작 문장을 주지 마세요.
'누구/기간/변화 요소', '관점', '한 문장으로 다시 만들어' 같은 평가·수업 용어를 절대 쓰지 마세요.
AI는 평가 시점을 정하지 않습니다. 아이가 질문을 보낼 때는 readyToEvaluate=false로 두세요.
'새로운 방법을 어떻게 만들 수 있을까?', '힘든 사람이 없게 할 수 없을까?'처럼 구체적인 해결책이 아직 없어도 변화를 만들려는 열린 질문은 change입니다.
답은 ${params.age}세 아이가 읽기 쉬운 따뜻한 한국어로 220자 안팎으로 쓰세요.
JSON 형식: {"relevant":true,"questionKind":"exploring","readyToEvaluate":false,"reply":"코치 답변"}`,
    ReplySchema,
  );
}

export async function evaluateGreatQuestion(params: {
  age: number;
  domainLabel: string;
  scenario: string;
  messages: { role: "child" | "assistant"; content: string }[];
}) {
  const transcript = params.messages
    .map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`)
    .join("\n");
  return jsonCompletion(
    `당신은 아이의 질문을 공정하게 평가하는 코치입니다. ${params.age}세, 분야: ${params.domainLabel}, 상황: ${params.scenario}\n대화:\n${transcript}
상황과 무관한 질문, 질문이 아닌 말이나 감상, 장난/무의미한 반복이면 relevant=false이고 모든 점수는 0입니다. 예를 들어 오늘 상황과 관계없이 '이게 무슨 뜻인지 쉽게 설명해줄래?'라고만 묻는 것은 0점입니다.
아이의 말에 실제로 알고 싶어 하는 물음이 있어야 합니다. 상황과 연결된 탐색 질문이나 변화 질문을 아이가 스스로 생각해 냈을 때만 평가하세요. 너무 짧거나 상황과 무관하거나 장난/반복이면 relevant=false이고 모든 점수는 0입니다. reason에는 평가 결과를 다정하게 설명하세요.
대화 전체에서 아이가 직접 말한 가장 좋은 질문을 찾으세요. 문법보다 호기심, 세상의 문제 발견, 해결된 모습 상상, 당연한 것 다시 묻기, 새로운 가능성, 다른 사람을 더 좋게 만드는 생각을 중요하게 평가하세요.
각 0~2점: 호기심(curiosity), 깊이(depth), 새로운 가능성(originality), 아이 생각이 드러나는 정도(clarity). 어려운 단어를 썼다고 점수를 더 주지 마세요.
보상 기준은 엄격하게 적용하세요. 상황과 이어진 짧은 추측이나 관찰 확인 질문은 좋은 시작이지만 보통 총점 4~5점, 즉 500P입니다. 1,000P는 '왜 그럴까'를 더 파고들거나, 다른 가능성을 비교하거나, 확인할 방법·조건을 함께 생각한 질문처럼 한 단계 더 깊을 때만 주세요. 1,500P와 2,000P는 여러 사람이나 미래에 미칠 변화까지 새롭게 생각한 매우 깊은 질문에만 주세요.
greatQuestion은 아이의 뜻을 바꾸지 말고 가장 좋은 질문을 자연스러운 한 문장으로만 가볍게 정리하세요. questionTitle은 아이가 좋아할 짧은 제목으로 만드세요.
reason은 점수 용어를 나열하지 말고, 이 질문이 어떤 새로운 생각의 문을 열었는지 쉬운 말 2문장으로 설명하세요.
예: '하늘은 왜 파래?'는 탐색 질문이고, '사람도 새처럼 하늘을 날 수 없을까?'는 변화 질문입니다.
JSON 형식: {"relevant":true,"curiosityScore":0,"depthScore":0,"originalityScore":0,"clarityScore":0,"reason":"...","greatQuestion":"아이의 변화 질문","questionTitle":"짧은 제목"}`,
    GreatQuestionEvaluationSchema,
  );
}
