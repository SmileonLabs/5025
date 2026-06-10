import { Router } from "express";
import { z } from "zod";
import { db, transactionsTable, childrenTable, parentsTable, missionLogsTable, missionsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { sendPushToParent } from "../lib/push";

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

// GET /api/transactions/:id — transaction detail (mission result viewable by parent or the child)
router.get("/transactions/:id", async (req, res) => {
  if (!req.session?.parentId && !req.session?.childId) {
    res.status(401).json({ error: "로그인이 필요해요." });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "거래 내역을 찾을 수 없어요." });
    return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, tx.childId)).limit(1);
  if (!child) {
    res.status(404).json({ error: "거래 내역을 찾을 수 없어요." });
    return;
  }

  // Authorization: the child's parent or the child themselves
  const isParent = req.session?.parentId === child.parentId;
  const isChild = req.session?.childId === tx.childId;
  if (!isParent && !isChild) {
    res.status(403).json({ error: "권한이 없어요." });
    return;
  }

  // For mission rewards, surface the completed mission result (passage + reflection)
  let mission = null;
  if (tx.type === "mission") {
    const [row] = await db
      .select({ log: missionLogsTable, mission: missionsTable })
      .from(missionLogsTable)
      .leftJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
      .where(eq(missionLogsTable.transactionId, tx.id))
      .limit(1);
    if (row) {
      mission = {
        missionTitle: row.mission?.title ?? null,
        missionType: row.mission?.type ?? null,
        bibleBook: row.log.bibleBook,
        bibleChapter: row.log.bibleChapter,
        reflection: row.log.reflection,
        status: row.log.status,
        completedAt: row.log.approvedAt ?? row.log.createdAt,
      };
    }
  }

  res.json({
    ...tx,
    child: { id: child.id, name: child.name, avatar: child.avatar },
    mission,
  });
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

  // Must be the child's parent or the child themselves
  const isParent = req.session?.parentId === child.parentId;
  const isChild = req.session?.childId === childId;
  if (!isParent && !isChild) {
    res.status(403).json({ error: "권한이 없어요." });
    return;
  }

  // Mission rewards are issued server-side only (see missions routes) — never client-supplied
  if (type === "mission") {
    res.status(403).json({ error: "미션 보상은 직접 등록할 수 없어요." });
    return;
  }

  // Charge (top-up): parent-only, positive amount, funded by parent's balance
  if (type === "charge") {
    if (!isParent || !req.session?.parentId) {
      res.status(403).json({ error: "용돈 충전은 부모님만 할 수 있어요." });
      return;
    }
    if (amount <= 0) {
      res.status(400).json({ error: "충전 금액은 0보다 커야 해요." });
      return;
    }
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, req.session.parentId)).limit(1);
    if (!parent || parent.balance < amount) {
      res.status(400).json({ error: "부모님 잔액이 부족해요." });
      return;
    }
    await db.update(parentsTable).set({ balance: parent.balance - amount }).where(eq(parentsTable.id, req.session.parentId));
  }

  // Spend: amount must reduce the balance and cannot overdraw
  if (type === "spend") {
    if (amount >= 0) {
      res.status(400).json({ error: "사용 금액이 올바르지 않아요." });
      return;
    }
    if (child.balance + amount < 0) {
      res.status(400).json({ error: "잔액이 부족해요." });
      return;
    }
  }

  // Update child balance
  const newBalance = child.balance + amount;
  await db.update(childrenTable).set({ balance: newBalance }).where(eq(childrenTable.id, childId));

  const [tx] = await db
    .insert(transactionsTable)
    .values({ childId, amount, description, type, category: category ?? null })
    .returning();

  if (type === "spend") {
    void sendPushToParent(child.parentId, {
      title: "💸 용돈 사용",
      body: `${child.name}님이 ${Math.abs(amount).toLocaleString()}원을 사용했어요. (${description})`,
    });
  }

  res.status(201).json({ ...tx, childBalance: newBalance });
});

export default router;
