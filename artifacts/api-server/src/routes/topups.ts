import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, parentsTable } from "@workspace/db";
import {
  completePendingBudgetTopup,
  createPendingBudgetTopup,
  getTopupByOrder,
  getTopupByOrderId,
  POINTS_PER_KRW,
} from "../topupCredit";
import { confirmTossPayment, getTossClientKey, getTossPayment, PaymentProviderError } from "../tossPayments";

const router: IRouter = Router();

const MIN_TOPUP = 1000;
const MAX_TOPUP = 1_000_000;

function getWebAppBaseUrl(req: Request): string {
  const configured = process.env["WEB_APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  const origin = req.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:5173";
}

function createOrderId(parentId: number): string {
  return `topup_${parentId}_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

const PrepareTopupBody = z.object({
  amount: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
});

const ConfirmTopupBody = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  amount: z.coerce.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
});

const TossWebhookBody = z.object({
  eventType: z.string(),
  data: z.object({ paymentKey: z.string().min(1) }).passthrough(),
});

// POST /api/topups/webhook/toss - verify the event by querying Toss, then idempotently credit it.
router.post("/topups/webhook/toss", async (req, res) => {
  const parsed = TossWebhookBody.safeParse(req.body);
  if (!parsed.success || parsed.data.eventType !== "PAYMENT_STATUS_CHANGED") {
    res.status(400).json({ error: "Unsupported Toss webhook payload." });
    return;
  }

  try {
    const payment = await getTossPayment(parsed.data.data.paymentKey);
    const orderId = payment.orderId;
    const totalAmount = payment.totalAmount;
    if (payment.status !== "DONE" || !orderId || typeof totalAmount !== "number" || !Number.isInteger(totalAmount)) {
      res.status(204).end();
      return;
    }
    const topup = await getTopupByOrderId(orderId);
    if (!topup || topup.amount !== totalAmount) {
      req.log.warn({ orderId }, "Toss webhook did not match a pending topup");
      res.status(204).end();
      return;
    }
    const credited = await completePendingBudgetTopup({
      parentId: topup.parentId,
      orderId,
      amount: totalAmount,
    });
    req.log.info({
      audit: "topup.reconciled",
      parentId: topup.parentId,
      orderId,
      amount: totalAmount,
      credited,
    }, "Toss webhook reconciled");
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Toss webhook reconciliation failed");
    res.status(502).json({ error: "Payment verification failed." });
  }
});

// POST /api/topups/prepare — create a Toss Payments top-up order
router.post("/topups/prepare", async (req, res) => {
  if (!req.session.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }

  const parsed = PrepareTopupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `${MIN_TOPUP.toLocaleString("ko-KR")}원 이상 입력해주세요.` });
    return;
  }

  const { amount } = parsed.data;
  const parentId = req.session.parentId;
  const orderId = createOrderId(parentId);
  const base = getWebAppBaseUrl(req);

  try {
    await createPendingBudgetTopup({ parentId, orderId, amount });
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, parentId)).limit(1);
    res.json({
      provider: "toss",
      clientKey: getTossClientKey(),
      customerKey: `parent_${parentId}_${randomUUID()}`,
      orderId,
      orderName: "5025 예산 충전",
      amount,
      successUrl: `${base}/?topup=success`,
      failUrl: `${base}/?topup=fail`,
      customerName: parent?.name,
      customerEmail: parent?.email,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to prepare Toss topup");
    res.status(502).json({ error: "결제 페이지를 만들지 못했어요." });
  }
});

// POST /api/topups/confirm — approve a Toss payment and credit the budget once
router.post("/topups/confirm", async (req, res) => {
  if (!req.session.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }

  const parsed = ConfirmTopupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }

  const { paymentKey, orderId, amount } = parsed.data;
  const parentId = req.session.parentId;

  try {
    const topup = await getTopupByOrder({ parentId, orderId });
    if (!topup) {
      res.status(403).json({ error: "권한이 없어요." });
      return;
    }

    if (topup.amount !== amount) {
      res.status(400).json({ error: "결제 금액이 일치하지 않아요." });
      return;
    }

    if (topup.status === "paid") {
      const [parent] = await db
        .select()
        .from(parentsTable)
        .where(eq(parentsTable.id, parentId))
        .limit(1);
      res.json({
        credited: false,
        status: "DONE",
        paidAmount: amount,
        creditedPoints: amount * POINTS_PER_KRW,
        balance: parent?.balance ?? 0,
      });
      return;
    }

    const payment = await confirmTossPayment({ paymentKey, orderId, amount });
    if (payment.orderId !== orderId || payment.paymentKey !== paymentKey || payment.totalAmount !== amount) {
      res.status(502).json({ error: "결제 승인 정보가 일치하지 않아요." });
      return;
    }

    if (payment.status !== "DONE") {
      const [parent] = await db
        .select()
        .from(parentsTable)
        .where(eq(parentsTable.id, parentId))
        .limit(1);
      res.json({ credited: false, status: payment.status, balance: parent?.balance ?? 0 });
      return;
    }

    const credited = await completePendingBudgetTopup({ parentId, orderId, amount });
    const [parent] = await db
      .select()
      .from(parentsTable)
      .where(eq(parentsTable.id, parentId))
      .limit(1);

    res.json({
      credited,
      paidAmount: amount,
      creditedPoints: amount * POINTS_PER_KRW,
      balance: parent?.balance ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to confirm Toss topup");
    if (err instanceof PaymentProviderError) {
      res.status(err.status >= 400 && err.status < 500 ? err.status : 502).json({
        error: err.message,
        code: err.code,
      });
      return;
    }
    res.status(502).json({ error: "결제 확인에 실패했어요." });
  }
});

export default router;
