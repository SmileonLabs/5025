import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  childrenTable,
  transactionsTable,
  gifticonOrdersTable,
  type GifticonOrder,
} from "@workspace/db";
import type { GifticonCatalogItem } from "./gifticonCatalog";

export type CreateOrderResult =
  | { ok: true; order: GifticonOrder; childBalance: number }
  | { ok: false; reason: "insufficient" };

/**
 * Atomically deduct the gifticon price from the child's balance and create the
 * order. Mirrors the proven topupCredit pattern (conditional UPDATE … WHERE
 * balance >= price RETURNING) to avoid the read-then-update (TOCTOU) race: if no
 * row comes back the balance was insufficient and nothing is charged.
 */
export async function createGifticonOrder(params: {
  childId: number;
  parentId: number;
  item: GifticonCatalogItem;
}): Promise<CreateOrderResult> {
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

export type RefundResult =
  | { ok: true; order: GifticonOrder; childBalance: number }
  | { ok: false; reason: "not_refundable" };

/**
 * Refund an order exactly once. The conditional UPDATE (status='requested')
 * guarantees only the first caller flips the status and issues the refund, so a
 * double cancel/reject can't refund twice. Pass `requireChildId` to scope a
 * child-initiated cancel to their own order.
 */
export async function refundGifticonOrder(params: {
  orderId: number;
  newStatus: "rejected" | "canceled";
  rejectReason?: string | null;
  requireChildId?: number;
}): Promise<RefundResult> {
  const { orderId, newStatus, rejectReason, requireChildId } = params;
  return db.transaction(async (tx) => {
    const conditions = [
      eq(gifticonOrdersTable.id, orderId),
      eq(gifticonOrdersTable.status, "requested"),
    ];
    if (requireChildId !== undefined) {
      conditions.push(eq(gifticonOrdersTable.childId, requireChildId));
    }

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

/**
 * Operator marks an order fulfilled with the manually-issued gifticon details.
 * Conditional on status='requested' so a double-fulfill is a no-op (returns
 * undefined). No balance change — the price was already deducted at request.
 */
export async function fulfillGifticonOrder(params: {
  orderId: number;
  issuedPin?: string | null;
  issuedBarcode?: string | null;
  issuedImageUrl?: string | null;
}): Promise<GifticonOrder | undefined> {
  const { orderId, issuedPin, issuedBarcode, issuedImageUrl } = params;
  const [order] = await db
    .update(gifticonOrdersTable)
    .set({
      status: "fulfilled",
      issuedPin: issuedPin ?? null,
      issuedBarcode: issuedBarcode ?? null,
      issuedImageUrl: issuedImageUrl ?? null,
      fulfilledAt: new Date(),
    })
    .where(and(eq(gifticonOrdersTable.id, orderId), eq(gifticonOrdersTable.status, "requested")))
    .returning();
  return order;
}
