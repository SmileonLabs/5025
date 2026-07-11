import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
export { pointsForEvaluation } from "./readingRewardPolicy";

const DialogueDecision = z.object({
  relevant: z.boolean(),
  shouldEnd: z.boolean(),
  safetyCategory: z.string().nullable(),
  reply: z.string().min(1).max(1200),
});
const SafetyDecision = z.object({ flagged: z.boolean() });

export const ReadingEvaluationSchema = z.object({
  relevant: z.boolean(),
  relevanceScore: z.number().int().min(0).max(2),
  specificityScore: z.number().int().min(0).max(2),
  reasoningScore: z.number().int().min(0).max(2),
  selfExpressionScore: z.number().int().min(0).max(2),
  followUpScore: z.number().int().min(0).max(2),
  reason: z.string().min(1).max(500),
});

type ReadingProfile = {
  age: number;
  grade: number | null;
  readingLevel: "easy" | "normal" | "advanced";
  aiAnswerLength: "short" | "normal" | "long";
  explainDifficultWords: boolean;
};

type ConversationMessage = { role: "child" | "assistant"; content: string };

function profileInstruction(profile: ReadingProfile): string {
  return `아이는 ${profile.age}세${profile.grade ? `, ${profile.grade}학년` : ""}이고 독서 수준은 ${profile.readingLevel}이다. 답변 길이는 ${profile.aiAnswerLength}이며 어려운 단어 설명은 ${profile.explainDifficultWords ? "제공" : "최소화"}한다.`;
}

async function jsonCompletion<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const completion = await openai.chat.completions.create({
    model: process.env.READING_AI_MODEL ?? "gpt-5-mini",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const content = completion.choices[0]?.message?.content ?? "";
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Reading AI returned no valid JSON.");
  return schema.parse(JSON.parse(json));
}

export async function moderateReadingMessage(input: string): Promise<boolean> {
  try {
    const result = await openai.moderations.create({ model: "omni-moderation-latest", input });
    return result.results[0]?.flagged ?? false;
  } catch (error: any) {
    // Replit's managed OpenAI proxy can expose chat completions without exposing
    // the moderation endpoint. Preserve the safety gate with a structured model
    // classification instead of failing open or breaking every reading message.
    if (error?.status !== 400 && error?.status !== 404) throw error;
    const decision = await jsonCompletion(
      `어린이 독서 서비스의 입력 안전성 검사다. 다음 내용에 성적 콘텐츠, 자해, 폭력 조장, 혐오, 불법행위 지시, 개인정보 노출 또는 어린이에게 위험한 내용이 있으면 flagged=true로 판단한다. 단순한 성경 이야기 속 사건 질문은 위험 지시가 아닌 한 허용한다. JSON만 반환: {"flagged":boolean}\n\n입력: ${input}`,
      SafetyDecision,
    );
    return decision.flagged;
  }
}

export async function createReadingReply(params: {
  sourceLabel: string;
  readingSummary?: string;
  profile: ReadingProfile;
  messages: ConversationMessage[];
}) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `너는 어린이 독서 대화 선생님이다. ${profileInstruction(params.profile)}
읽은 범위: ${params.sourceLabel}
아이 요약: ${params.readingSummary ?? "없음"}
대화:
${transcript}

마지막 아이 질문이 읽은 범위나 아이가 설명한 내용과 관련되는지 판단한다.
- 무관하면 정답을 제공하지 말고 읽은 내용에서 질문하도록 다정하게 유도한다.
- 관련되면 아이 수준에 맞게 답하고 한 번에 후속 질문 하나만 한다.
- 책에 없는 내용을 아는 척하거나 만들어내지 않는다.
- 위험하거나 부적절한 내용은 안전하게 경계를 설명하고 보호자에게 말하도록 안내한다.
JSON만 반환: {"relevant":boolean,"shouldEnd":boolean,"safetyCategory":string|null,"reply":string}`,
    DialogueDecision,
  );
}

export async function evaluateReadingConversation(params: {
  sourceLabel: string;
  profile: ReadingProfile;
  messages: ConversationMessage[];
}) {
  const transcript = params.messages.map((m) => `${m.role === "child" ? "아이" : "AI"}: ${m.content}`).join("\n");
  return jsonCompletion(
    `어린이 독서 대화 평가자다. ${profileInstruction(params.profile)}
읽은 범위: ${params.sourceLabel}
대화:
${transcript}

나이에 맞춰 공정하게 평가한다. 읽은 내용과 관련된 아이 질문이 없거나 무의미한 반복뿐이면 relevant=false이며 모든 점수는 0이다.
각 점수는 0~2 정수다: 관련성, 구체성, 이유를 생각함, 자기표현, 후속질문.
reason은 아이에게 직접 말하는 다정한 한국어로 2문장 이내로 쓴다.
첫 문장에는 아이가 잘한 점을 구체적으로 칭찬하고, 다음 문장에는 받은 포인트의 이유나 다음에 더 좋은 질문을 만드는 쉬운 방법을 설명한다.
"관련성 점수", "추론", "평가 기준" 같은 딱딱한 채점 용어는 쓰지 않는다. relevant=false일 때도 혼내지 말고 읽은 내용에서 다시 궁금한 점을 찾아보도록 격려한다.
JSON만 반환: {"relevant":boolean,"relevanceScore":number,"specificityScore":number,"reasoningScore":number,"selfExpressionScore":number,"followUpScore":number,"reason":string}`,
    ReadingEvaluationSchema,
  );
}
