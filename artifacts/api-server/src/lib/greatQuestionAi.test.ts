import test from "node:test";
import assert from "node:assert/strict";
import { greatQuestionPoints } from "./greatQuestionRewardPolicy";

const evaluation = (total: number, relevant = true) => ({
  relevant,
  curiosityScore: Math.min(2, total),
  depthScore: Math.min(2, Math.max(0, total - 2)),
  originalityScore: Math.min(2, Math.max(0, total - 4)),
  clarityScore: Math.min(2, Math.max(0, total - 6)),
  reason: "평가",
});

test("위대한 질문은 무관하거나 얕은 답이면 완료 포인트가 없다", () => {
  assert.equal(greatQuestionPoints(evaluation(8, false)), 0);
  assert.equal(greatQuestionPoints(evaluation(3)), 0);
});

test("위대한 질문 보상은 500P부터 2,000P까지 단계적으로 지급된다", () => {
  assert.equal(greatQuestionPoints(evaluation(4)), 500);
  assert.equal(greatQuestionPoints(evaluation(5)), 500);
  assert.equal(greatQuestionPoints(evaluation(6)), 1000);
  assert.equal(greatQuestionPoints(evaluation(7)), 1500);
  assert.equal(greatQuestionPoints(evaluation(8)), 2000);
});
