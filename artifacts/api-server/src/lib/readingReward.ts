import { and, eq, gte, sql } from "drizzle-orm";
import { childrenTable, db, missionLogsTable, parentsTable, readingAttemptsTable, transactionsTable, type ReadingEvaluation } from "@workspace/db";

class ReadingRewardError extends Error {
  constructor(public reason: "already_processed" | "insufficient_parent") { super(reason); }
}

export async function failReadingAttempt(attemptId: number, evaluation: ReadingEvaluation, reason: string) {
  const [attempt] = await db.update(readingAttemptsTable)
    .set({ status: "failed", rewardPoints: 0, evaluation, evaluationReason: reason, completedAt: new Date() })
    .where(and(eq(readingAttemptsTable.id, attemptId), eq(readingAttemptsTable.status, "in_progress")))
    .returning();
  return attempt;
}

export async function completeReadingReward(params: {
  attemptId: number;
  missionId: number;
  parentId: number;
  childId: number;
  readingUnitKey: string;
  rewardPoints: number;
  evaluation: ReadingEvaluation;
  description: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [attempt] = await tx.update(readingAttemptsTable)
        .set({ status: "completed", rewardPoints: params.rewardPoints, evaluation: params.evaluation, evaluationReason: params.evaluation.reason, completedAt: new Date() })
        .where(and(eq(readingAttemptsTable.id, params.attemptId), eq(readingAttemptsTable.status, "in_progress")))
        .returning();
      if (!attempt) throw new ReadingRewardError("already_processed");

      const [parent] = await tx.update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} - ${params.rewardPoints}` })
        .where(and(eq(parentsTable.id, params.parentId), gte(parentsTable.balance, params.rewardPoints)))
        .returning();
      if (!parent) throw new ReadingRewardError("insufficient_parent");

      const [child] = await tx.update(childrenTable)
        .set({ balance: sql`${childrenTable.balance} + ${params.rewardPoints}` })
        .where(eq(childrenTable.id, params.childId)).returning();
      const [transaction] = await tx.insert(transactionsTable)
        .values({ childId: params.childId, amount: params.rewardPoints, description: params.description, type: "mission" }).returning();
      await tx.update(readingAttemptsTable).set({ transactionId: transaction.id }).where(eq(readingAttemptsTable.id, params.attemptId));
      const [log] = await tx.insert(missionLogsTable)
        .values({ missionId: params.missionId, childId: params.childId, status: "completed", reflection: params.evaluation.reason, transactionId: transaction.id })
        .returning();
      return { ok: true as const, attempt, log, transaction, childBalance: child.balance, parentBalance: parent.balance };
    });
  } catch (error) {
    if (error instanceof ReadingRewardError) return { ok: false as const, reason: error.reason };
    throw error;
  }
}

export async function resetReadingAttempt(params: {
  attemptId: number;
  childId: number;
  parentId: number;
  rewardPoints: number;
  transactionId: number | null;
  sourceLabel: string;
}) {
  return db.transaction(async (tx) => {
    if (params.transactionId && params.rewardPoints > 0) {
      const [child] = await tx.update(childrenTable)
        .set({ balance: sql`${childrenTable.balance} - ${params.rewardPoints}` })
        .where(and(eq(childrenTable.id, params.childId), gte(childrenTable.balance, params.rewardPoints)))
        .returning();
      if (!child) return { ok: false as const, reason: "spent" as const };

      await tx.update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} + ${params.rewardPoints}` })
        .where(eq(parentsTable.id, params.parentId));
      await tx.insert(transactionsTable).values({
        childId: params.childId,
        amount: -params.rewardPoints,
        description: `${params.sourceLabel} 독서 대화 재도전 반환`,
        type: "refund",
        category: "reading_retry",
      });
      await tx.update(missionLogsTable)
        .set({ status: "reverted" })
        .where(eq(missionLogsTable.transactionId, params.transactionId));
    }

    await tx.update(readingAttemptsTable)
      .set({ status: "reset", resetAt: new Date(), resetReason: "child_retry" })
      .where(eq(readingAttemptsTable.id, params.attemptId));
    return { ok: true as const };
  });
}
