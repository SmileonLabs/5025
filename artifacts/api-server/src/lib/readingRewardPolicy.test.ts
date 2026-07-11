import test from "node:test";
import assert from "node:assert/strict";
import { pointsForEvaluation, type ReadingScore } from "./readingRewardPolicy";

const score = (total: number, relevant = true): ReadingScore => {
  const values = [0, 0, 0, 0, 0];
  for (let index = 0, remaining = total; index < values.length; index += 1) {
    values[index] = Math.min(2, remaining); remaining -= values[index];
  }
  return { relevant, relevanceScore: values[0], specificityScore: values[1], reasoningScore: values[2], selfExpressionScore: values[3], followUpScore: values[4] };
};

test("irrelevant or zero relevance never completes", () => {
  assert.equal(pointsForEvaluation(score(10, false)), 0);
  assert.equal(pointsForEvaluation(score(0, true)), 0);
});
test("reward boundaries remain fixed", () => {
  assert.equal(pointsForEvaluation(score(1)), 500);
  assert.equal(pointsForEvaluation(score(4)), 500);
  assert.equal(pointsForEvaluation(score(5)), 1000);
  assert.equal(pointsForEvaluation(score(7)), 1500);
  assert.equal(pointsForEvaluation(score(9)), 2000);
  assert.equal(pointsForEvaluation(score(10)), 2000);
});
