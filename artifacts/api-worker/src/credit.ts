import { and, eq, gte, sql } from "drizzle-orm";
import type { WorkerDb } from "./db";
import {
  childrenTable,
  gifticonOrdersTable,
  missionLogsTable,
  parentsTable,
  topupsTable,
  transactionsTable,
  type DbMissionLog,
  type GifticonOrder,
  type QuizQuestion,
  type Transaction,
} from "./db";

export const TOPUP_KIND = "budget_topup";
export const POINTS_PER_KRW = 10;

type RewardReason = "insufficient_parent" | "already_processed" | "duplicate";

class RewardError extends Error {
  constructor(public reason: RewardReason) {
    super(reason);
  }
}

function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur != null; i += 1) {
    if (typeof cur === "object" && (cur as { code?: string }).code === "23505") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

export async function createPendingBudgetTopup(
  db: WorkerDb,
  params: { parentId: number; orderId: string; amount: number },
): Promise<void> {
  await db
    .insert(topupsTable)
    .values({
      parentId: params.parentId,
      stripeSessionId: params.orderId,
      amount: params.amount,
      status: "pending",
    })
    .onConflictDoNothing({ target: topupsTable.stripeSessionId });
}

export async function getTopupByOrder(
  db: WorkerDb,
  params: { parentId: number; orderId: string },
) {
  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(and(eq(topupsTable.parentId, params.parentId), eq(topupsTable.stripeSessionId, params.orderId)))
    .limit(1);

  return topup ?? null;
}

export async function completePendingBudgetTopup(
  db: WorkerDb,
  params: { parentId: number; orderId: string; amount: number },
): Promise<boolean> {
  const { parentId, orderId, amount } = params;
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(topupsTable)
      .set({ status: "paid" })
      .where(
        and(
          eq(topupsTable.parentId, parentId),
          eq(topupsTable.stripeSessionId, orderId),
          eq(topupsTable.amount, amount),
          eq(topupsTable.status, "pending"),
        ),
      )
      .returning();

    if (!updated) return false;

    await tx
      .update(parentsTable)
      .set({ balance: sql`${parentsTable.balance} + ${amount * POINTS_PER_KRW}` })
      .where(eq(parentsTable.id, parentId));

    return true;
  });
}

export async function creditBudgetTopup(
  db: WorkerDb,
  params: { parentId: number; sessionId: string; amount: number },
): Promise<boolean> {
  const { parentId, sessionId, amount } = params;
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(topupsTable)
      .values({ parentId, stripeSessionId: sessionId, amount, status: "paid" })
      .onConflictDoNothing({ target: topupsTable.stripeSessionId })
      .returning();

    if (inserted.length === 0) return false;

    if (amount > 0) {
      await tx
        .update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} + ${amount * POINTS_PER_KRW}` })
        .where(eq(parentsTable.id, parentId));
    }
    return true;
  });
}

export type GrantBibleResult =
  | { ok: true; log: DbMissionLog; tx: Transaction; childBalance: number; parentBalance: number }
  | { ok: false; reason: "insufficient_parent" | "duplicate" };

export async function grantBibleReward(
  db: WorkerDb,
  params: {
    parentId: number;
    childId: number;
    missionId: number;
    reward: number;
    bibleBook: string;
    bibleChapter: number;
    reflection: string;
    quiz?: QuizQuestion[];
    description: string;
  },
): Promise<GrantBibleResult> {
  const { parentId, childId, missionId, reward, bibleBook, bibleChapter, reflection, quiz, description } = params;
  try {
    return await db.transaction(async (tx) => {
      const [parent] = await tx
        .update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} - ${reward}` })
        .where(and(eq(parentsTable.id, parentId), gte(parentsTable.balance, reward)))
        .returning();
      if (!parent) throw new RewardError("insufficient_parent");

      const [child] = await tx
        .update(childrenTable)
        .set({ balance: sql`${childrenTable.balance} + ${reward}` })
        .where(eq(childrenTable.id, childId))
        .returning();

      const [txRow] = await tx
        .insert(transactionsTable)
        .values({ childId, amount: reward, description, type: "mission" })
        .returning();

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

export async function approveActivityLog(
  db: WorkerDb,
  params: { logId: number; parentId: number; childId: number; reward: number; description: string },
): Promise<ApproveActivityResult> {
  const { logId, parentId, childId, reward, description } = params;
  try {
    return await db.transaction(async (tx) => {
      const [log] = await tx
        .update(missionLogsTable)
        .set({ status: "approved", approvedAt: new Date() })
        .where(and(eq(missionLogsTable.id, logId), eq(missionLogsTable.status, "requested")))
        .returning();
      if (!log) throw new RewardError("already_processed");

      const [parent] = await tx
        .update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} - ${reward}` })
        .where(and(eq(parentsTable.id, parentId), gte(parentsTable.balance, reward)))
        .returning();
      if (!parent) throw new RewardError("insufficient_parent");

      const [child] = await tx
        .update(childrenTable)
        .set({ balance: sql`${childrenTable.balance} + ${reward}` })
        .where(eq(childrenTable.id, childId))
        .returning();

      const [txRow] = await tx
        .insert(transactionsTable)
        .values({ childId, amount: reward, description, type: "mission" })
        .returning();

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

export interface OrderableItem {
  id: string;
  brand: string;
  productName: string;
  faceValue: number;
  price: number;
  emoji: string;
}

export async function createGifticonOrder(
  db: WorkerDb,
  params: { childId: number; parentId: number; item: OrderableItem },
): Promise<{ ok: true; order: GifticonOrder; childBalance: number } | { ok: false; reason: "insufficient" }> {
  const { childId, parentId, item } = params;
  return db.transaction(async (tx) => {
    const [child] = await tx
      .update(childrenTable)
      .set({ balance: sql`${childrenTable.balance} - ${item.price}` })
      .where(and(eq(childrenTable.id, childId), gte(childrenTable.balance, item.price)))
      .returning();
    if (!child) return { ok: false, reason: "insufficient" };

    const [txRow] = await tx
      .insert(transactionsTable)
      .values({
        childId,
        amount: -item.price,
        description: `${item.brand} ${item.productName}`,
        type: "gifticon",
      })
      .returning();

    const [order] = await tx
      .insert(gifticonOrdersTable)
      .values({
        childId,
        parentId,
        catalogItemId: item.id,
        brand: item.brand,
        productName: item.productName,
        faceValue: item.faceValue,
        price: item.price,
        emoji: item.emoji,
        status: "requested",
        transactionId: txRow.id,
      })
      .returning();

    return { ok: true, order, childBalance: child.balance };
  });
}

export async function refundGifticonOrder(
  db: WorkerDb,
  params: {
    orderId: number;
    newStatus: "rejected" | "canceled";
    rejectReason?: string | null;
    requireChildId?: number;
    requireParentId?: number;
  },
): Promise<{ ok: true; order: GifticonOrder; childBalance: number } | { ok: false; reason: "not_refundable" }> {
  const { orderId, newStatus, rejectReason, requireChildId, requireParentId } = params;
  return db.transaction(async (tx) => {
    const conditions = [eq(gifticonOrdersTable.id, orderId), eq(gifticonOrdersTable.status, "requested")];
    if (requireChildId !== undefined) conditions.push(eq(gifticonOrdersTable.childId, requireChildId));
    if (requireParentId !== undefined) conditions.push(eq(gifticonOrdersTable.parentId, requireParentId));

    const [order] = await tx
      .update(gifticonOrdersTable)
      .set({ status: newStatus, rejectReason: rejectReason ?? null })
      .where(and(...conditions))
      .returning();
    if (!order) return { ok: false, reason: "not_refundable" };

    const [child] = await tx
      .update(childrenTable)
      .set({ balance: sql`${childrenTable.balance} + ${order.price}` })
      .where(eq(childrenTable.id, order.childId))
      .returning();

    const [refundTx] = await tx
      .insert(transactionsTable)
      .values({
        childId: order.childId,
        amount: order.price,
        description: `환불: ${order.brand} ${order.productName}`,
        type: "refund",
      })
      .returning();

    const [finalOrder] = await tx
      .update(gifticonOrdersTable)
      .set({ refundTransactionId: refundTx.id })
      .where(eq(gifticonOrdersTable.id, order.id))
      .returning();

    return { ok: true, order: finalOrder ?? order, childBalance: child?.balance ?? 0 };
  });
}

export async function fulfillGifticonOrder(
  db: WorkerDb,
  params: {
    orderId: number;
    issuedPin?: string | null;
    issuedBarcode?: string | null;
    issuedImageUrl?: string | null;
    requireParentId?: number;
    markUsed?: boolean;
  },
): Promise<GifticonOrder | undefined> {
  const { orderId, issuedPin, issuedBarcode, issuedImageUrl, requireParentId, markUsed } = params;
  const conditions = [eq(gifticonOrdersTable.id, orderId), eq(gifticonOrdersTable.status, "requested")];
  if (requireParentId !== undefined) conditions.push(eq(gifticonOrdersTable.parentId, requireParentId));
  const now = new Date();
  const [order] = await db
    .update(gifticonOrdersTable)
    .set({
      status: markUsed ? "used" : "fulfilled",
      issuedPin: issuedPin ?? null,
      issuedBarcode: issuedBarcode ?? null,
      issuedImageUrl: issuedImageUrl ?? null,
      fulfilledAt: now,
      ...(markUsed ? { usedAt: now } : {}),
    })
    .where(and(...conditions))
    .returning();
  return order;
}

export async function markGifticonOrderUsed(
  db: WorkerDb,
  params: { orderId: number; childId: number },
): Promise<GifticonOrder | undefined> {
  const { orderId, childId } = params;
  const [order] = await db
    .update(gifticonOrdersTable)
    .set({ status: "used", usedAt: new Date() })
    .where(
      and(
        eq(gifticonOrdersTable.id, orderId),
        eq(gifticonOrdersTable.childId, childId),
        eq(gifticonOrdersTable.status, "fulfilled"),
      ),
    )
    .returning();
  return order;
}
