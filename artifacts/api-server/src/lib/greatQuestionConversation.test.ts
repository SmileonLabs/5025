import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuestionDecision } from "./greatQuestionConversation";

const exploring = { relevant: true, questionKind: "exploring" as const, readyToEvaluate: false };

test("사실의 답을 찾는 질문은 탐색 질문으로 유지한다", () => {
  assert.deepEqual(normalizeQuestionDecision(exploring, "금속은 왜 뜨거워져?"), exploring);
});

test("새로운 가능성을 여는 표현은 변화 질문으로 인정한다", () => {
  assert.equal(normalizeQuestionDecision(exploring, "뜨거워지지 않는 놀이터를 어떻게 만들 수 있을까?").questionKind, "change");
  assert.equal(normalizeQuestionDecision(exploring, "사람도 하늘을 날 수 없을까?").readyToEvaluate, true);
  assert.equal(normalizeQuestionDecision(exploring, "꼭 지금과 같은 방법으로 해야 할까?").questionKind, "change");
});

test("오늘 상황과 무관하면 변화 표현이 있어도 평가 가능으로 바꾸지 않는다", () => {
  const offTopic = { relevant: false, questionKind: "off_topic" as const, readyToEvaluate: false };
  assert.deepEqual(normalizeQuestionDecision(offTopic, "만약 게임을 더 오래 하면 어떨까?"), offTopic);
});

