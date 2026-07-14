export type GreatQuestionDecision = {
  relevant: boolean;
  questionKind: "exploring" | "change" | "off_topic";
  readyToEvaluate: boolean;
};

const CHANGE_QUESTION_PATTERN = /(어떻게\s*(?:하면|만들|바꿀|도울|줄일|해결)|[가-힣]{1,20}\s*수\s*없을까|방법.{0,12}없을까|꼭.{0,30}(?:해야\s*(?:해|할까)|그래야)|만약)/;

export function normalizeQuestionDecision<T extends GreatQuestionDecision>(decision: T, childMessage: string): T {
  if (!decision.relevant || !CHANGE_QUESTION_PATTERN.test(childMessage)) return decision;
  return { ...decision, questionKind: "change", readyToEvaluate: true };
}
