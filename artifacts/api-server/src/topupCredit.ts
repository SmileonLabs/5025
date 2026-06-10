import { eq, sql } from "drizzle-orm";
import { db, parentsTable, topupsTable } from "@workspace/db";

/** Stripe Checkout metadata marker for parent budget top-ups. */
export const TOPUP_KIND = "budget_topup";

/**
 * Idempotently credit a parent's budget for a paid Checkout session.
 *
 * The UNIQUE `stripe_session_id` column plus `onConflictDoNothing` makes a
 * repeated confirm (e.g. reloading the success URL) a no-op: only the first
 * insert applies the balance bump.
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
        .set({ balance: sql`${parentsTable.balance} + ${amount}` })
        .where(eq(parentsTable.id, parentId));
    }
    return true;
  });
}
