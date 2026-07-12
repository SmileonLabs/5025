import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
export { greatQuestionPoints } from "./greatQuestionRewardPolicy";

const ScenarioSchema = z.object({ scenario: z.string().min(20).max(500), opening: z.string().min(10).max(500) });
const ReplySchema = z.object({ relevant: z.boolean(), readyToEvaluate: z.boolean(), reply: z.string().min(1).max(700) });
export const GreatQuestionEvaluationSchema = z.object({
  relevant: z.boolean(), curiosityScore: z.number().int().min(0).max(2), depthScore: z.number().int().min(0).max(2),
  originalityScore: z.number().int().min(0).max(2), clarityScore: z.number().int().min(0).max(2), reason: z.string().min(1).max(400),
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
직업을 고르게 하지 말고, 아이가 호기심을 느낄 생활 속 문제나 상상 상황 하나를 주세요. 정답이나 해결책을 말하지 마세요.
최근 상황과 겹치지 않게 하세요: ${params.recentScenarios.join(" | ") || "없음"}
opening은 상황을 짧게 소개한 뒤 '무엇이 궁금해?'처럼 아이 자신의 질문을 한 개 만들어 보도록 다정하게 유도하세요.
JSON 형식: {"scenario":"오늘의 상황","opening":"아이에게 보낼 첫 메시지"}`,
    ScenarioSchema,
  );
}

export async function createGreatQuestionReply(params: { age: number; domainLabel: string; scenario: string; messages: { role: "child" | "assistant"; content: string }[] }) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `당신은 ${params.age}세 아이의 질문력을 키우는 코치입니다. 분야: ${params.domainLabel}. 오늘 상황: ${params.scenario}
대화:\n${transcript}
아이의 마지막 말이 상황과 관련 있는지 판단하세요. 관련 없으면 relevant=false로 하고 혼내지 말고 오늘 상황에서 궁금한 것을 다시 찾게 하세요.
관련 있으면 질문을 대신 만들어 주지 말고, 왜/만약/다른 입장/그 다음은 같은 관점 중 하나만 사용해 더 깊은 질문을 스스로 만들게 도우세요.
아이가 자기 생각이 담긴 열린 질문을 명확히 만들었다면 readyToEvaluate=true로 하세요. 답은 짧고 쉬운 한국어로 쓰세요.
JSON 형식: {"relevant":true,"readyToEvaluate":false,"reply":"코치 답변"}`,
    ReplySchema,
  );
}

export async function evaluateGreatQuestion(params: { age: number; domainLabel: string; scenario: string; messages: { role: "child" | "assistant"; content: string }[] }) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `당신은 아이의 질문을 공정하게 평가하는 코치입니다. ${params.age}세, 분야: ${params.domainLabel}, 상황: ${params.scenario}\n대화:\n${transcript}
상황과 무관하거나 질문이 없거나 장난/무의미한 반복이면 relevant=false이고 모든 점수는 0입니다.
각 0~2점: 호기심(curiosity), 깊이(depth), 자기만의 관점(originality), 알아듣기 쉬움(clarity).
reason은 점수 용어를 나열하지 말고, 아이가 잘한 점과 다음에 더 멋진 질문을 만드는 방법을 쉬운 말 2문장으로 설명하세요.
JSON 형식: {"relevant":true,"curiosityScore":0,"depthScore":0,"originalityScore":0,"clarityScore":0,"reason":"..."}`,
    GreatQuestionEvaluationSchema,
  );
}
