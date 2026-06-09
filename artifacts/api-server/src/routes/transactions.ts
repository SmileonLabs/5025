import { Router } from "express";
import { z } from "zod";
import { db, transactionsTable, childrenTable, parentsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

const router = Router();

const CreateTxBody = z.object({
  childId: z.number().int().positive(),
  amount: z.number().int(),
  description: z.string().min(1),
  type: z.enum(["mission", "charge", "spend"]),
  category: z.string().max(50).optional(),
});

// GET /api/transactions — get transactions for logged-in child
router.get("/transactions", async (req, res) => {
  if (!req.session?.childId) {
    res.status(401).json({ error: "아이 로그인이 필요해요." });
    return;
  }
  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.childId, req.session.childId))
    .orderBy(desc(transactionsTable.createdAt));
  res.json(txs);
});

// GET /api/transactions/all — parent gets all their children's transactions
router.get("/transactions/all", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모님 로그인이 필요해요." });
    return;
  }
  const kids = await db.select({ id: childrenTable.id }).from(childrenTable).where(eq(childrenTable.parentId, req.session.parentId));
  const childIds = kids.map(k => k.id);
  if (childIds.length === 0) {
    res.json([]);
    return;
  }
  const txs = await db
    .select()
    .from(transactionsTable)
    .where(inArray(transactionsTable.childId, childIds))
    .orderBy(desc(transactionsTable.createdAt));
  res.json(txs);
});

// POST /api/transactions — create transaction (parent-authorized for charge; child for spend/mission)
router.post("/transactions", async (req, res) => {
  const parsed = CreateTxBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인해주세요." });
    return;
  }
  const { childId, amount, description, type, category } = parsed.data;

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) {
    res.status(404).json({ error: "아이를 찾을 수 없어요." });
    return;
  }

  // Authorization: parent can charge/reward, child can spend/earn (mission)
  const isParent = req.session?.parentId === child.parentId;
  const isChild = req.session?.childId === childId;
  if (!isParent && !isChild) {
    res.status(403).json({ error: "권한이 없어요." });
    return;
  }

  // Balance check for spend
  if (type === "spend" && child.balance + amount < 0) {
    res.status(400).json({ error: "잔액이 부족해요." });
    return;
  }

  // Update child balance
  const newBalance = child.balance + amount;
  await db.update(childrenTable).set({ balance: newBalance }).where(eq(childrenTable.id, childId));

  // If charge, deduct from parent balance
  if (type === "charge" && req.session?.parentId) {
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, req.session.parentId)).limit(1);
    if (parent && parent.balance >= amount) {
      await db.update(parentsTable).set({ balance: parent.balance - amount }).where(eq(parentsTable.id, req.session.parentId));
    }
  }

  const [tx] = await db
    .insert(transactionsTable)
    .values({ childId, amount, description, type, category: category ?? null })
    .returning();

  res.status(201).json({ ...tx, childBalance: newBalance });
});

export default router;
