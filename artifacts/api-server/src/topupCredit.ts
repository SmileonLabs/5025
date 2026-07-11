import { and, eq, sql } from "drizzle-orm";
import { db, parentsTable, topupsTable } from "@workspace/db";

/** Payment metadata marker for parent budget top-ups. */
export const TOPUP_KIND = "budget_topup";

/** Points credited per KRW paid. 1,000원 결제 → 10,000포인트(×10), 즉 1P = 0.1원. */
export const POINTS_PER_KRW = 10;

export async function createPendingBudgetTopup(params: {
  parentId: number;
  orderId: string;
  amount: number;
}): Promise<void> {
  const { parentId, orderId, amount } = params;
  await db
    .insert(topupsTable)
    .values({ parentId, stripeSessionId: orderId, amount, status: "pending" })
    .onConflictDoNothing({ target: topupsTable.stripeSessionId });
}

export async function getTopupByOrder(params: {
  parentId: number;
  orderId: string;
}) {
  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(and(eq(topupsTable.parentId, params.parentId), eq(topupsTable.stripeSessionId, params.orderId)))
    .limit(1);

  return topup ?? null;
}

export async function getTopupByOrderId(orderId: string) {
  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.stripeSessionId, orderId))
    .limit(1);
  return topup ?? null;
}

export async function completePendingBudgetTopup(params: {
  parentId: number;
  orderId: string;
  amount: number;
}): Promise<boolean> {
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

/**
 * Idempotently credit a parent's budget for a paid Checkout session.
 *
 * The UNIQUE payment reference column plus `onConflictDoNothing` makes a
 * repeated confirm (e.g. reloading the success URL) a no-op: only the first
 * insert applies the balance bump.
 *
 * `topups.amount` stores the paid amount in KRW (for payment reconciliation),
 * while the parent's balance is credited in points at `POINTS_PER_KRW` per KRW.
 *
 * Returns true if this call applied the credit, false if it was already
 * credited (conflict) or the amount was non-positive.
 */
export async function creditBudgetTopup(params: {
  parentId: number;
  sessionId: string;
  amount: number;
}): Promise<boolean> {
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
