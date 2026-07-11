import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, childrenTable, parentsTable, transactionsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

const router = Router();

const CreateChildBody = z.object({
  name: z.string().min(1).max(20),
  age: z.number().int().min(1).max(18),
  avatar: z.string().min(1),
  pin: z.string().length(4).regex(/^\d{4}$/),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  readingLevel: z.enum(["easy", "normal", "advanced"]).optional(),
  aiAnswerLength: z.enum(["short", "normal", "long"]).optional(),
  explainDifficultWords: z.boolean().optional(),
  dailyReadingRetryLimit: z.number().int().min(1).max(10).optional(),
});

const UpdateReadingProfileBody = z.object({
  grade: z.number().int().min(1).max(12).nullable().optional(),
  readingLevel: z.enum(["easy", "normal", "advanced"]).optional(),
  aiAnswerLength: z.enum(["short", "normal", "long"]).optional(),
  explainDifficultWords: z.boolean().optional(),
  dailyReadingRetryLimit: z.number().int().min(1).max(10).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one setting is required.");

function publicChild(child: typeof childrenTable.$inferSelect) {
  return {
    id: child.id, name: child.name, age: child.age, grade: child.grade,
    readingLevel: child.readingLevel, aiAnswerLength: child.aiAnswerLength,
    explainDifficultWords: child.explainDifficultWords,
    dailyReadingRetryLimit: child.dailyReadingRetryLimit,
    avatar: child.avatar, balance: child.balance, parentId: child.parentId,
  };
}

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
  res.json(children.map(publicChild));
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
  const { name, age, avatar, pin, ...readingProfile } = parsed.data;
  const pinHash = await bcrypt.hash(pin, 12);
  const [child] = await db
    .insert(childrenTable)
    .values({ parentId: req.session.parentId!, name, age, avatar, pinHash, balance: 0, ...readingProfile })
    .returning();
  res.status(201).json(publicChild(child));
});

// PATCH /api/children/:id/reading-profile - parent-controlled AI reading level.
router.patch("/children/:id/reading-profile", requireParent, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateReadingProfileBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: "독서 수준 설정을 확인해 주세요." });
    return;
  }
  const [child] = await db.update(childrenTable)
    .set(parsed.data)
    .where(and(eq(childrenTable.id, id), eq(childrenTable.parentId, req.session.parentId!)))
    .returning();
  if (!child) {
    res.status(404).json({ error: "아이 계정을 찾을 수 없어요." });
    return;
  }
  res.json(publicChild(child));
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
