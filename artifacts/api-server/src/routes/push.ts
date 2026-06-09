import { Router } from "express";
import { z } from "zod";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getVapidPublicKey } from "../lib/push";

const router = Router();

// GET /api/push/public-key — frontend needs this to subscribe
router.get("/push/public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: "푸시 알림이 설정되지 않았어요." });
    return;
  }
  res.json({ publicKey: key });
});

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// POST /api/push/subscribe — parent registers a device for push
router.post("/push/subscribe", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모님 로그인이 필요해요." });
    return;
  }
  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "구독 정보를 확인해주세요." });
    return;
  }
  const { endpoint, keys } = parsed.data;

  // Upsert by endpoint: a device may re-register or move to another parent account.
  const [existing] = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptionsTable)
      .set({ parentId: req.session.parentId, p256dh: keys.p256dh, auth: keys.auth })
      .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      parentId: req.session.parentId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
  }

  res.status(201).json({ ok: true });
});

const UnsubscribeBody = z.object({ endpoint: z.string().url() });

// POST /api/push/unsubscribe — parent removes a device
router.post("/push/unsubscribe", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모님 로그인이 필요해요." });
    return;
  }
  const parsed = UnsubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "구독 정보를 확인해주세요." });
    return;
  }
  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
        eq(pushSubscriptionsTable.parentId, req.session.parentId),
      ),
    );
  res.json({ ok: true });
});

export default router;
