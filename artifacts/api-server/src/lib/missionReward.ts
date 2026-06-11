import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  parentsTable,
  childrenTable,
  transactionsTable,
  missionLogsTable,
  type QuizQuestion,
  type DbMissionLog,
  type Transaction,
} from "@workspace/db";

/**
 * 닫힌 용돈 구조의 핵심: 아이 미션 보상은 무에서 발행되지 않고 부모(parents.balance)에서
 * 차감되어 아이(children.balance)로 이동한다. 부모 충전 포인트(실돈 결제)가 보상의 재원이다.
 *
 * 돈 이동은 반드시 db.transaction + 조건부 UPDATE(WHERE balance >= reward RETURNING)로 처리해
 * read-then-update(TOCTOU) 경합과 음수 잔액을 막는다. (gifticonCredit/topupCredit 패턴 미러링.)
 */

type RewardReason = "insufficient_parent" | "already_processed" | "duplicate";

/** 트랜잭션 콜백 내부에서 throw해 롤백시키는 sentinel. 바깥 catch에서 reason으로 변환한다. */
class RewardError extends Error {
  constructor(public reason: RewardReason) {
    super(reason);
  }
}

/**
 * Postgres unique_violation (부분 유니크 인덱스 위반 = 같은 장 동시 완료).
 * drizzle-orm은 드라이버 에러를 DrizzleQueryError로 감싸 실제 pg 에러(code='23505')가
 * `e.cause`에 들어가므로 cause 체인을 따라 내려가며 확인한다.
 */
function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur != null; i++) {
    if (typeof cur === "object" && (cur as { code?: string }).code === "23505") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

export type GrantBibleResult =
  | { ok: true; log: DbMissionLog; tx: Transaction; childBalance: number; parentBalance: number }
  | { ok: false; reason: "insufficient_parent" | "duplicate" };

/**
 * bible 미션 즉시 적립. 부모 차감 → 아이 적립 → 거래기록 → 미션로그를 한 트랜잭션으로 묶는다.
 * 부모 잔액 부족이면 아무것도 변경하지 않고 insufficient_parent, 같은 장 중복이면 duplicate.
 */
export async function grantBibleReward(params: {
  parentId: number;
  childId: number;
  missionId: number;
  reward: number;
  bibleBook: string;
  bibleChapter: number;
  reflection: string;
  quiz?: QuizQuestion[];
  description: string;
}): Promise<GrantBibleResult> {
  const { parentId, childId, missionId, reward, bibleBook, bibleChapter, reflection, quiz, description } = params;
  try {
    return await db.transaction(async (tx) => {
      // 1. 부모 잔액 조건부 차감. 부족하면 행이 없으므로 롤백.
      const [parent] = await tx
        .update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} - ${reward}` })
        .where(and(eq(parentsTable.id, parentId), gte(parentsTable.balance, reward)))
        .returning();
      if (!parent) throw new RewardError("insufficient_parent");

      // 2. 아이 잔액 적립.
      const [child] = await tx
        .update(childrenTable)
        .set({ balance: sql`${childrenTable.balance} + ${reward}` })
        .where(eq(childrenTable.id, childId))
        .returning();

      // 3. 아이 거래기록.
      const [txRow] = await tx
        .insert(transactionsTable)
        .values({ childId, amount: reward, description, type: "mission" })
        .returning();

      // 4. 미션 로그. 부분 유니크 인덱스 위반 시 unique_violation → 전체 롤백(부모 차감 포함).
      const [log] = await tx
        .insert(missionLogsTable)
        .values({
          missionId,
          childId,
          status: "completed",
          bibleBook,
          bibleChapter,
          reflection,
          quiz: quiz ?? null,
          transactionId: txRow.id,
        })
        .returning();

      return { ok: true as const, log, tx: txRow, childBalance: child.balance, parentBalance: parent.balance };
    });
  } catch (e) {
    if (e instanceof RewardError && e.reason === "insufficient_parent") {
      return { ok: false, reason: "insufficient_parent" };
    }
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate" };
    throw e;
  }
}

export type ApproveActivityResult =
  | { ok: true; log: DbMissionLog; childBalance: number; parentBalance: number }
  | { ok: false; reason: "insufficient_parent" | "already_processed" };

/**
 * activity 미션 부모 승인 시 적립. 트랜잭션 첫 단계에서 로그 상태를 requested→approved로
 * 조건부 전환해 동시 이중 승인을 차단하고, 이어서 부모 차감/아이 적립/거래기록/로그-거래연결을 처리한다.
 * 부모 잔액 부족이면 롤백(로그는 requested로 복귀)하고 insufficient_parent를 돌려준다.
 */
export async function approveActivityLog(params: {
  logId: number;
  parentId: number;
  childId: number;
  reward: number;
  description: string;
}): Promise<ApproveActivityResult> {
  const { logId, parentId, childId, reward, description } = params;
  try {
    return await db.transaction(async (tx) => {
      // 1. 상태 조건부 전환(requested→approved). 행이 없으면 이미 처리됨.
      const [log] = await tx
        .update(missionLogsTable)
        .set({ status: "approved", approvedAt: new Date() })
        .where(and(eq(missionLogsTable.id, logId), eq(missionLogsTable.status, "requested")))
        .returning();
      if (!log) throw new RewardError("already_processed");

      // 2. 부모 잔액 조건부 차감. 부족하면 롤백 → 로그 requested 복귀.
      const [parent] = await tx
        .update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} - ${reward}` })
        .where(and(eq(parentsTable.id, parentId), gte(parentsTable.balance, reward)))
        .returning();
      if (!parent) throw new RewardError("insufficient_parent");

      // 3. 아이 잔액 적립.
      const [child] = await tx
        .update(childrenTable)
        .set({ balance: sql`${childrenTable.balance} + ${reward}` })
        .where(eq(childrenTable.id, childId))
        .returning();

      // 4. 아이 거래기록.
      const [txRow] = await tx
        .insert(transactionsTable)
        .values({ childId, amount: reward, description, type: "mission" })
        .returning();

      // 5. 로그에 거래 연결.
      const [finalLog] = await tx
        .update(missionLogsTable)
        .set({ transactionId: txRow.id })
        .where(eq(missionLogsTable.id, logId))
        .returning();

      return { ok: true as const, log: finalLog ?? log, childBalance: child.balance, parentBalance: parent.balance };
    });
  } catch (e) {
    if (e instanceof RewardError && (e.reason === "insufficient_parent" || e.reason === "already_processed")) {
      return { ok: false, reason: e.reason };
    }
    throw e;
  }
}
