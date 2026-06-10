import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, parentsTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { creditBudgetTopup, TOPUP_KIND, POINTS_PER_KRW } from "../topupCredit";

const router: IRouter = Router();

// KRW is a Stripe zero-decimal currency (unit_amount == won). Stripe rejects
// charges below roughly $0.50, so keep a safe minimum.
const MIN_TOPUP = 1000;
const MAX_TOPUP = 1_000_000;

function getBaseUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:5000";
}

// POST /api/topups/checkout-session — start a Stripe Checkout to top up parent budget
router.post("/topups/checkout-session", async (req, res) => {
  if (!req.session.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }

  const parsed = z
    .object({ amount: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `${MIN_TOPUP.toLocaleString("ko-KR")}원 이상 입력해주세요.` });
    return;
  }

  const { amount } = parsed.data;
  const parentId = req.session.parentId;
  const base = getBaseUrl();

  try {
    const stripe = await getUncachableStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "krw",
            unit_amount: amount, // KRW is zero-decimal; do NOT multiply by 100
            product_data: { name: "예산 충전 (성경 용돈)" },
          },
          quantity: 1,
        },
      ],
      metadata: { parentId: String(parentId), kind: TOPUP_KIND },
      success_url: `${base}/?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?topup=cancel`,
    });

    if (!checkout.url) {
      res.status(502).json({ error: "결제 페이지를 만들지 못했어요." });
      return;
    }

    res.json({ url: checkout.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create Stripe checkout session");
    res.status(502).json({ error: "결제 페이지를 만들지 못했어요." });
  }
});

// POST /api/topups/confirm — verify a completed Checkout and credit the budget once
router.post("/topups/confirm", async (req, res) => {
  if (!req.session.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }

  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }

  const { sessionId } = parsed.data;
  const parentId = req.session.parentId;

  try {
    const stripe = await getUncachableStripeClient();
    // Retrieve directly from Stripe (authoritative) to avoid the webhook-vs-redirect race.
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only this app's budget top-ups are confirmable by their owning parent.
    if (
      session.metadata?.["parentId"] !== String(parentId) ||
      session.metadata?.["kind"] !== TOPUP_KIND
    ) {
      res.status(403).json({ error: "권한이 없어요." });
      return;
    }

    if (session.payment_status !== "paid") {
      const [parent] = await db
        .select()
        .from(parentsTable)
        .where(eq(parentsTable.id, parentId))
        .limit(1);
      res.json({ credited: false, status: session.payment_status, balance: parent?.balance ?? 0 });
      return;
    }

    const amount = session.amount_total ?? 0;

    // Idempotent credit shared with the webhook path (unique stripe_session_id
    // makes a repeated confirm — or a confirm racing the webhook — a no-op).
    const credited = await creditBudgetTopup({ parentId, sessionId, amount });

    const [parent] = await db
      .select()
      .from(parentsTable)
      .where(eq(parentsTable.id, parentId))
      .limit(1);

    // `paidAmount` is the KRW charged; `creditedPoints` is what landed in the
    // balance (KRW × POINTS_PER_KRW). The balance is always in points.
    res.json({
      credited,
      paidAmount: amount,
      creditedPoints: amount * POINTS_PER_KRW,
      balance: parent?.balance ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to confirm topup");
    res.status(502).json({ error: "결제 확인에 실패했어요." });
  }
});

export default router;
