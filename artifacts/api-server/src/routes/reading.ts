import { Router } from "express";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  childrenTable, db, missionAssignmentsTable, missionsTable,
  readingAttemptsTable, readingMessagesTable, booksTable, bookReadingUnitsTable,
} from "@workspace/db";
import { readingFeatureFlags } from "../lib/featureFlags";
import { createReadingReply, evaluateReadingConversation, moderateReadingMessage, pointsForEvaluation } from "../lib/readingConversation";
import { completeReadingReward, failReadingAttempt } from "../lib/readingReward";

const router = Router();

function requireChild(req: any, res: any, next: any) {
  if (!req.session?.childId) { res.status(401).json({ error: "아이 로그인이 필요해요." }); return; }
  if (!readingFeatureFlags.conversationEnabled) { res.status(404).json({ error: "독서 대화 기능이 아직 준비 중이에요." }); return; }
  next();
}

const StartBody = z.object({
  missionId: z.number().int().positive(),
  readingUnitKey: z.string().min(3).max(160),
  sourceLabel: z.string().min(2).max(200),
  readingSummary: z.string().max(1000).optional(),
});
const MessageBody = z.object({ content: z.string().trim().min(2).max(800) });

async function ownedAttempt(attemptId: number, childId: number) {
  const [row] = await db.select({ attempt: readingAttemptsTable, child: childrenTable, mission: missionsTable })
    .from(readingAttemptsTable)
    .innerJoin(childrenTable, eq(readingAttemptsTable.childId, childrenTable.id))
    .innerJoin(missionsTable, eq(readingAttemptsTable.missionId, missionsTable.id))
    .where(and(eq(readingAttemptsTable.id, attemptId), eq(readingAttemptsTable.childId, childId))).limit(1);
  return row;
}

router.post("/reading/attempts", requireChild, async (req, res) => {
  const parsed = StartBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "읽은 범위를 확인해 주세요." }); return; }
  const childId = req.session.childId!;
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, parsed.data.missionId)).limit(1);
  if (!child || !mission || !mission.isActive || mission.parentId !== child.parentId || !["bible", "book"].includes(mission.type)) {
    res.status(404).json({ error: "독서 미션을 찾을 수 없어요." }); return;
  }
  if (mission.type === "book" && !readingFeatureFlags.bookMissionsEnabled) { res.status(404).json({ error: "일반도서 미션은 아직 준비 중이에요." }); return; }
  let readingUnitKey = parsed.data.readingUnitKey;
  let sourceLabel = parsed.data.sourceLabel;
  let readingSummary = parsed.data.readingSummary;
  if (mission.type === "book") {
    const match = /^book:(\d+):(\d+)$/.exec(readingUnitKey);
    if (!match || mission.bookId !== Number(match[1])) { res.status(400).json({ error: "책의 읽은 범위를 확인해 주세요." }); return; }
    const [unit] = await db.select({ unit: bookReadingUnitsTable, book: booksTable }).from(bookReadingUnitsTable)
      .innerJoin(booksTable, eq(bookReadingUnitsTable.bookId, booksTable.id))
      .where(and(eq(bookReadingUnitsTable.id, Number(match[2])), eq(booksTable.id, mission.bookId), eq(booksTable.parentId, child.parentId), eq(booksTable.verifiedByParent, true))).limit(1);
    if (!unit) { res.status(400).json({ error: "확인된 목차를 선택해 주세요." }); return; }
    sourceLabel = `${unit.book.title} - ${unit.unit.title}`;
    readingSummary = unit.book.description ?? undefined;
  }
  if (!mission.assignToAll) {
    const [assigned] = await db.select().from(missionAssignmentsTable)
      .where(and(eq(missionAssignmentsTable.missionId, mission.id), eq(missionAssignmentsTable.childId, childId))).limit(1);
    if (!assigned) { res.status(403).json({ error: "이 미션의 대상이 아니에요." }); return; }
  }
  const [completed] = await db.select({ id: readingAttemptsTable.id }).from(readingAttemptsTable)
    .where(and(eq(readingAttemptsTable.missionId, mission.id), eq(readingAttemptsTable.childId, childId), eq(readingAttemptsTable.readingUnitKey, parsed.data.readingUnitKey), eq(readingAttemptsTable.status, "completed"))).limit(1);
  if (completed) { res.status(409).json({ error: "이미 완료한 읽기 범위예요." }); return; }
  const [{ attemptsToday }] = await db.select({ attemptsToday: count() }).from(readingAttemptsTable)
    .where(and(eq(readingAttemptsTable.missionId, mission.id), eq(readingAttemptsTable.childId, childId), gte(readingAttemptsTable.startedAt, sql`date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`)));
  const limit = Math.min(child.dailyReadingRetryLimit, mission.maxReadingAttemptsPerDay);
  if (Number(attemptsToday) >= limit) { res.status(429).json({ error: `오늘은 ${limit}번까지 도전할 수 있어요.` }); return; }

  const [attempt] = await db.insert(readingAttemptsTable).values({
    childId,
    missionId: mission.id,
    readingUnitKey,
    sourceLabel,
    readingSummary,
  }).returning();
  const opening = `오늘 읽은 ${sourceLabel}에서 가장 궁금했던 일이나 “왜 그랬을까?”라고 생각한 것을 이야기해 줄래?`;
  await db.insert(readingMessagesTable).values({ attemptId: attempt.id, role: "assistant", content: opening });
  res.status(201).json({ attempt, message: { role: "assistant", content: opening } });
});

router.post("/reading/attempts/:id/messages", requireChild, async (req, res) => {
  const id = Number(req.params.id); const parsed = MessageBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: "질문을 확인해 주세요." }); return; }
  const row = await ownedAttempt(id, req.session.childId!);
  if (!row || row.attempt.status !== "in_progress") { res.status(404).json({ error: "진행 중인 독서 대화를 찾을 수 없어요." }); return; }
  const flagged = await moderateReadingMessage(parsed.data.content);
  if (flagged) { res.status(400).json({ error: "이 내용은 답하기 어려워요. 보호자에게 이야기하고 책에 관한 질문을 해 주세요." }); return; }
  await db.insert(readingMessagesTable).values({ attemptId: id, role: "child", content: parsed.data.content });
  const history = await db.select().from(readingMessagesTable).where(eq(readingMessagesTable.attemptId, id)).orderBy(readingMessagesTable.createdAt);
  const decision = await createReadingReply({
    sourceLabel: row.attempt.sourceLabel, readingSummary: row.attempt.readingSummary ?? undefined,
    profile: row.child,
    messages: history.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "child" | "assistant", content: m.content })),
  });
  const offTopicCount = row.attempt.offTopicCount + (decision.relevant ? 0 : 1);
  await db.transaction(async (tx) => {
    await tx.insert(readingMessagesTable).values({ attemptId: id, role: "assistant", content: decision.reply, safetyCategory: decision.safetyCategory });
    await tx.update(readingAttemptsTable).set({ childMessageCount: row.attempt.childMessageCount + 1, offTopicCount }).where(eq(readingAttemptsTable.id, id));
  });
  if (!decision.relevant && offTopicCount >= 2) {
    const evaluation = { relevant: false, relevanceScore: 0, specificityScore: 0, reasoningScore: 0, selfExpressionScore: 0, followUpScore: 0, reason: "읽은 내용과 관련된 질문이 없어 미션이 완료되지 않았습니다." };
    await failReadingAttempt(id, evaluation, evaluation.reason);
    res.json({ message: decision.reply, status: "failed", rewardPoints: 0, canRetry: true }); return;
  }
  res.json({ message: decision.reply, relevant: decision.relevant, shouldEnd: decision.shouldEnd, status: "in_progress" });
});

router.post("/reading/attempts/:id/complete", requireChild, async (req, res) => {
  const id = Number(req.params.id); const row = await ownedAttempt(id, req.session.childId!);
  if (!Number.isInteger(id) || !row || row.attempt.status !== "in_progress") { res.status(404).json({ error: "진행 중인 독서 대화를 찾을 수 없어요." }); return; }
  if (row.attempt.childMessageCount < row.mission.minConversationTurns) { res.status(409).json({ error: `질문을 ${row.mission.minConversationTurns}번 이상 나눠야 해요.` }); return; }
  const history = await db.select().from(readingMessagesTable).where(eq(readingMessagesTable.attemptId, id)).orderBy(readingMessagesTable.createdAt);
  const evaluation = await evaluateReadingConversation({ sourceLabel: row.attempt.sourceLabel, profile: row.child, messages: history.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "child" | "assistant", content: m.content })) });
  const rawPoints = pointsForEvaluation(evaluation);
  if (!evaluation.relevant || rawPoints === 0) {
    await failReadingAttempt(id, evaluation, evaluation.reason);
    res.json({ status: "failed", rewardPoints: 0, canRetry: true, evaluation }); return;
  }
  const points = Math.max(row.mission.minRewardPoints, Math.min(row.mission.maxRewardPoints, rawPoints));
  const result = await completeReadingReward({ attemptId: id, missionId: row.mission.id, parentId: row.mission.parentId, childId: row.child.id, readingUnitKey: row.attempt.readingUnitKey, rewardPoints: points, evaluation, description: `${row.attempt.sourceLabel} 독서 대화 완료` });
  if (!result.ok) { res.status(result.reason === "insufficient_parent" ? 402 : 409).json({ error: result.reason === "insufficient_parent" ? "부모님 포인트가 부족해 아직 완료되지 않았어요." : "이미 처리된 대화예요." }); return; }
  res.json({ status: "completed", rewardPoints: points, evaluation, childBalance: result.childBalance });
});

router.get("/reading/attempts/:id", requireChild, async (req, res) => {
  const row = await ownedAttempt(Number(req.params.id), req.session.childId!);
  if (!row) { res.status(404).json({ error: "독서 대화를 찾을 수 없어요." }); return; }
  const messages = await db.select().from(readingMessagesTable).where(eq(readingMessagesTable.attemptId, row.attempt.id)).orderBy(readingMessagesTable.createdAt);
  res.json({ ...row.attempt, messages });
});

export default router;
