import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, childrenTable, parentsTable, transactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const CreateChildBody = z.object({
  name: z.string().min(1).max(20),
  age: z.number().int().min(1).max(18),
  avatar: z.string().min(1),
  pin: z.string().length(4).regex(/^\d{4}$/),
});

function requireParent(req: any, res: any, next: any) {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }
  next();
}

// GET /api/children — list children for logged-in parent
router.get("/children", requireParent, async (req, res) => {
  const children = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.parentId, req.session.parentId!));
  res.json(children.map(c => ({ id: c.id, name: c.name, age: c.age, avatar: c.avatar, balance: c.balance, parentId: c.parentId })));
});

// GET /api/children/public — list children (name + id only) for child login — no auth required
router.get("/children/public", async (req, res) => {
  const { parentEmail } = req.query as { parentEmail?: string };
  if (!parentEmail) {
    res.status(400).json({ error: "parentEmail이 필요해요." });
    return;
  }
  const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.email, parentEmail)).limit(1);
  if (!parent) {
    res.status(404).json({ error: "부모 계정을 찾을 수 없어요." });
    return;
  }
  const children = await db.select().from(childrenTable).where(eq(childrenTable.parentId, parent.id));
  res.json(children.map(c => ({ id: c.id, name: c.name, avatar: c.avatar, parentId: c.parentId })));
});

// POST /api/children — create child
router.post("/children", requireParent, async (req, res) => {
  const parsed = CreateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인해주세요.", details: parsed.error.issues });
    return;
  }
  const { name, age, avatar, pin } = parsed.data;
  const pinHash = await bcrypt.hash(pin, 12);
  const [child] = await db
    .insert(childrenTable)
    .values({ parentId: req.session.parentId!, name, age, avatar, pinHash, balance: 0 })
    .returning();
  res.status(201).json({ id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId });
});

// DELETE /api/children/:id
router.delete("/children/:id", requireParent, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id)).limit(1);
  if (!child || child.parentId !== req.session.parentId!) {
    res.status(404).json({ error: "아이 계정을 찾을 수 없어요." });
    return;
  }
  await db.delete(childrenTable).where(eq(childrenTable.id, id));
  res.json({ ok: true });
});

// GET /api/children/:id/transactions
router.get("/children/:id/transactions", requireParent, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.childId, id))
    .orderBy(desc(transactionsTable.createdAt));
  res.json(txs);
});

export default router;
