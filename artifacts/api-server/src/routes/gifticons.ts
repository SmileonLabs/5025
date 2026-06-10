import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  db,
  gifticonOrdersTable,
  childrenTable,
  gifticonCatalogItemsTable,
  type GifticonOrder,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  createGifticonOrder,
  refundGifticonOrder,
  fulfillGifticonOrder,
} from "../lib/gifticonCredit";
import { requireAdmin } from "../lib/adminAuth";
import { sendPushToParent } from "../lib/push";

const router: IRouter = Router();

/** Strip the issued secrets from a list payload — those are only ever returned
 * by the authorized detail endpoint. */
function toListItem(o: GifticonOrder) {
  const { issuedPin: _p, issuedBarcode: _b, issuedImageUrl: _i, ...rest } = o;
  return rest;
}

// ---- Catalog (per-parent) ----

// GET /api/gifticons/catalog — items belonging to the session's parent.
// A child sees their own parent's catalog; a parent sees their own.
router.get("/gifticons/catalog", async (req, res) => {
  let parentId: number | undefined;
  if (req.session?.childId) {
    const [child] = await db
      .select({ parentId: childrenTable.parentId })
      .from(childrenTable)
      .where(eq(childrenTable.id, req.session.childId))
      .limit(1);
    parentId = child?.parentId;
  } else if (req.session?.parentId) {
    parentId = req.session.parentId;
  }
  if (parentId === undefined) {
    res.status(401).json({ error: "로그인이 필요해요." });
    return;
  }
  const items = await db
    .select()
    .from(gifticonCatalogItemsTable)
    .where(eq(gifticonCatalogItemsTable.parentId, parentId))
    .orderBy(desc(gifticonCatalogItemsTable.createdAt));
  res.json(items);
});

const CatalogItemBody = z.object({
  brand: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(1).max(100),
  price: z.number().int().min(1).max(10_000_000),
  emoji: z.string().trim().min(1).max(20).optional(),
});

// POST /api/gifticons/catalog — parent registers a new shop item
router.post("/gifticons/catalog", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }
  const parsed = CatalogItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." });
    return;
  }
  const { brand, productName, price, emoji } = parsed.data;
  const [item] = await db
    .insert(gifticonCatalogItemsTable)
    .values({
      parentId: req.session.parentId,
      brand,
      productName,
      price,
      ...(emoji ? { emoji } : {}),
    })
    .returning();
  res.status(201).json(item);
});

// DELETE /api/gifticons/catalog/:id — parent deletes their own item
router.delete("/gifticons/catalog/:id", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const [deleted] = await db
    .delete(gifticonCatalogItemsTable)
    .where(
      and(
        eq(gifticonCatalogItemsTable.id, id),
        eq(gifticonCatalogItemsTable.parentId, req.session.parentId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "상품을 찾을 수 없어요." });
    return;
  }
  res.json({ ok: true });
});

// ---- Orders ----

// POST /api/gifticons/orders — a child buys a gifticon (price deducted now)
router.post("/gifticons/orders", async (req, res) => {
  if (!req.session?.childId) {
    res.status(401).json({ error: "아이 로그인이 필요해요." });
    return;
  }
  const parsed = z.object({ catalogItemId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "상품을 선택해주세요." });
    return;
  }
  const itemId = Number(parsed.data.catalogItemId);
  if (!Number.isInteger(itemId)) {
    res.status(400).json({ error: "판매하지 않는 상품이에요." });
    return;
  }

  const [child] = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.id, req.session.childId))
    .limit(1);
  if (!child) {
    res.status(404).json({ error: "아이를 찾을 수 없어요." });
    return;
  }

  // Price authority: only an item belonging to THIS child's parent is sellable,
  // and the price is read from the DB — the client only ever sends an id.
  const [dbItem] = await db
    .select()
    .from(gifticonCatalogItemsTable)
    .where(
      and(
        eq(gifticonCatalogItemsTable.id, itemId),
        eq(gifticonCatalogItemsTable.parentId, child.parentId),
      ),
    )
    .limit(1);
  if (!dbItem) {
    res.status(400).json({ error: "판매하지 않는 상품이에요." });
    return;
  }

  const result = await createGifticonOrder({
    childId: child.id,
    parentId: child.parentId,
    item: {
      id: String(dbItem.id),
      brand: dbItem.brand,
      productName: dbItem.productName,
      faceValue: dbItem.price,
      price: dbItem.price,
      emoji: dbItem.emoji,
    },
  });
  if (!result.ok) {
    res.status(400).json({ error: "잔액이 부족해요." });
    return;
  }

  void sendPushToParent(child.parentId, {
    title: "🎁 기프티콘 구매 요청",
    body: `${child.name}님이 ${dbItem.brand} ${dbItem.productName}을(를) 구매했어요.`,
    url: "/",
  });

  res.status(201).json({ order: result.order, childBalance: result.childBalance });
});

// GET /api/gifticons/orders — child: own orders; parent: their children's orders
router.get("/gifticons/orders", async (req, res) => {
  if (req.session?.childId) {
    const rows = await db
      .select()
      .from(gifticonOrdersTable)
      .where(eq(gifticonOrdersTable.childId, req.session.childId))
      .orderBy(desc(gifticonOrdersTable.createdAt));
    res.json(rows.map(toListItem));
    return;
  }
  if (req.session?.parentId) {
    const rows = await db
      .select({
        id: gifticonOrdersTable.id,
        childId: gifticonOrdersTable.childId,
        parentId: gifticonOrdersTable.parentId,
        catalogItemId: gifticonOrdersTable.catalogItemId,
        brand: gifticonOrdersTable.brand,
        productName: gifticonOrdersTable.productName,
        faceValue: gifticonOrdersTable.faceValue,
        price: gifticonOrdersTable.price,
        emoji: gifticonOrdersTable.emoji,
        status: gifticonOrdersTable.status,
        rejectReason: gifticonOrdersTable.rejectReason,
        fulfilledAt: gifticonOrdersTable.fulfilledAt,
        createdAt: gifticonOrdersTable.createdAt,
        childName: childrenTable.name,
        childAvatar: childrenTable.avatar,
      })
      .from(gifticonOrdersTable)
      .innerJoin(childrenTable, eq(gifticonOrdersTable.childId, childrenTable.id))
      .where(eq(gifticonOrdersTable.parentId, req.session.parentId))
      .orderBy(desc(gifticonOrdersTable.createdAt));
    res.json(rows);
    return;
  }
  res.status(401).json({ error: "로그인이 필요해요." });
});

// GET /api/gifticons/orders/:id — full detail incl. issued secrets (authorized)
router.get("/gifticons/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const [order] = await db
    .select()
    .from(gifticonOrdersTable)
    .where(eq(gifticonOrdersTable.id, id))
    .limit(1);
  if (!order) {
    res.status(404).json({ error: "주문을 찾을 수 없어요." });
    return;
  }

  const isOwnerChild = req.session?.childId === order.childId;
  const isParent = req.session?.parentId === order.parentId;
  const isAdmin = req.session?.isAdmin === true;
  if (!isOwnerChild && !isParent && !isAdmin) {
    res.status(403).json({ error: "권한이 없어요." });
    return;
  }

  res.json(order);
});

// POST /api/gifticons/orders/:id/cancel — child cancels their own pending order
router.post("/gifticons/orders/:id/cancel", async (req, res) => {
  if (!req.session?.childId) {
    res.status(401).json({ error: "아이 로그인이 필요해요." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }

  const result = await refundGifticonOrder({
    orderId: id,
    newStatus: "canceled",
    requireChildId: req.session.childId,
  });
  if (!result.ok) {
    res.status(409).json({ error: "취소할 수 없는 주문이에요." });
    return;
  }
  res.json({ order: result.order, childBalance: result.childBalance });
});

// ---- Parent fulfillment / rejection ----

// Parent fulfill: pin/barcode/image are ALL optional — a parent who hand-delivers
// the gifticon outside the app just marks it sent (no secrets entered).
const ParentFulfillBody = z.object({
  issuedPin: z.string().trim().max(200).optional(),
  issuedBarcode: z.string().trim().max(200).optional(),
  issuedImageUrl: z
    .string()
    .trim()
    .url()
    .regex(/^https?:\/\//i, "http(s) URL만 허용해요")
    .max(2000)
    .optional(),
});

// PATCH /api/gifticons/orders/:id/fulfill — parent marks their child's order sent
router.patch("/gifticons/orders/:id/fulfill", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const parsed = ParentFulfillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인해주세요." });
    return;
  }

  const order = await fulfillGifticonOrder({
    orderId: id,
    requireParentId: req.session.parentId,
    issuedPin: parsed.data.issuedPin,
    issuedBarcode: parsed.data.issuedBarcode,
    issuedImageUrl: parsed.data.issuedImageUrl,
  });
  if (!order) {
    res.status(409).json({ error: "발급할 수 없는 주문이에요." });
    return;
  }
  res.json(order);
});

const ParentRejectBody = z.object({ reason: z.string().trim().max(500).optional() });

// PATCH /api/gifticons/orders/:id/reject — parent rejects their child's order (refunds)
router.patch("/gifticons/orders/:id/reject", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const parsed = ParentRejectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인해주세요." });
    return;
  }

  const result = await refundGifticonOrder({
    orderId: id,
    newStatus: "rejected",
    rejectReason: parsed.data.reason ?? null,
    requireParentId: req.session.parentId,
  });
  if (!result.ok) {
    res.status(409).json({ error: "거절할 수 없는 주문이에요." });
    return;
  }
  res.json({ order: result.order, childBalance: result.childBalance });
});

// ---- Operator (admin) endpoints ----

// GET /api/gifticons/admin/orders — all orders, newest first (requested first)
router.get("/gifticons/admin/orders", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: gifticonOrdersTable.id,
      childId: gifticonOrdersTable.childId,
      catalogItemId: gifticonOrdersTable.catalogItemId,
      brand: gifticonOrdersTable.brand,
      productName: gifticonOrdersTable.productName,
      faceValue: gifticonOrdersTable.faceValue,
      price: gifticonOrdersTable.price,
      emoji: gifticonOrdersTable.emoji,
      status: gifticonOrdersTable.status,
      rejectReason: gifticonOrdersTable.rejectReason,
      issuedPin: gifticonOrdersTable.issuedPin,
      issuedBarcode: gifticonOrdersTable.issuedBarcode,
      issuedImageUrl: gifticonOrdersTable.issuedImageUrl,
      fulfilledAt: gifticonOrdersTable.fulfilledAt,
      createdAt: gifticonOrdersTable.createdAt,
      childName: childrenTable.name,
      childAvatar: childrenTable.avatar,
    })
    .from(gifticonOrdersTable)
    .innerJoin(childrenTable, eq(gifticonOrdersTable.childId, childrenTable.id))
    .orderBy(desc(gifticonOrdersTable.createdAt));
  res.json(rows);
});

const FulfillBody = z
  .object({
    issuedPin: z.string().trim().max(200).optional(),
    issuedBarcode: z.string().trim().max(200).optional(),
    issuedImageUrl: z
      .string()
      .trim()
      .url()
      .regex(/^https?:\/\//i, "http(s) URL만 허용해요")
      .max(2000)
      .optional(),
  })
  .refine((v) => v.issuedPin || v.issuedBarcode || v.issuedImageUrl, {
    message: "핀번호, 바코드, 이미지 중 하나는 입력해야 해요.",
  });

// PATCH /api/gifticons/admin/orders/:id/fulfill — operator issues the gifticon
router.patch("/gifticons/admin/orders/:id/fulfill", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const parsed = FulfillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." });
    return;
  }

  const order = await fulfillGifticonOrder({
    orderId: id,
    issuedPin: parsed.data.issuedPin,
    issuedBarcode: parsed.data.issuedBarcode,
    issuedImageUrl: parsed.data.issuedImageUrl,
  });
  if (!order) {
    res.status(409).json({ error: "발급할 수 없는 주문이에요." });
    return;
  }

  void sendPushToParent(order.parentId, {
    title: "🎁 기프티콘 발급 완료",
    body: `${order.brand} ${order.productName} 기프티콘이 발급되었어요.`,
    url: "/",
  });

  res.json(order);
});

const RejectBody = z.object({ reason: z.string().trim().max(500).optional() });

// PATCH /api/gifticons/admin/orders/:id/reject — operator rejects (refunds)
router.patch("/gifticons/admin/orders/:id/reject", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const parsed = RejectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인해주세요." });
    return;
  }

  const result = await refundGifticonOrder({
    orderId: id,
    newStatus: "rejected",
    rejectReason: parsed.data.reason ?? null,
  });
  if (!result.ok) {
    res.status(409).json({ error: "거절할 수 없는 주문이에요." });
    return;
  }

  void sendPushToParent(result.order.parentId, {
    title: "기프티콘 구매 취소",
    body: `${result.order.brand} ${result.order.productName} 구매가 취소되어 ${result.order.price.toLocaleString("ko-KR")}P가 환불되었어요.`,
    url: "/",
  });

  res.json({ order: result.order, childBalance: result.childBalance });
});

export default router;
