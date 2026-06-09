import { Router } from "express";
import { z } from "zod";
import { db, missionsTable, missionLogsTable, childrenTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";

const router = Router();

function requireParent(req: any, res: any, next: any) {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모 로그인이 필요해요." });
    return;
  }
  next();
}

function requireChild(req: any, res: any, next: any) {
  if (!req.session?.childId) {
    res.status(401).json({ error: "아이 로그인이 필요해요." });
    return;
  }
  next();
}

const CreateMissionBody = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  type: z.enum(["bible", "auto", "confirm"]),
  reward: z.number().int().min(0).max(100000),
  isActive: z.boolean().default(true),
});

// GET /api/missions
router.get("/missions", async (req, res) => {
  if (req.session?.parentId) {
    const missions = await db
      .select()
      .from(missionsTable)
      .where(eq(missionsTable.parentId, req.session.parentId))
      .orderBy(desc(missionsTable.createdAt));
    res.json(missions);
    return;
  }
  if (req.session?.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.session.childId)).limit(1);
    if (!child) { res.status(404).json({ error: "아이를 찾을 수 없어요." }); return; }
    const missions = await db
      .select()
      .from(missionsTable)
      .where(and(eq(missionsTable.parentId, child.parentId), eq(missionsTable.isActive, true)))
      .orderBy(desc(missionsTable.createdAt));
    res.json(missions);
    return;
  }
  res.status(401).json({ error: "로그인이 필요해요." });
});

// POST /api/missions
router.post("/missions", requireParent, async (req, res) => {
  const parsed = CreateMissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "입력값을 확인해주세요." }); return; }
  const [mission] = await db
    .insert(missionsTable)
    .values({ parentId: req.session.parentId!, ...parsed.data })
    .returning();
  res.status(201).json(mission);
});

// PATCH /api/missions/:id
router.patch("/missions/:id", requireParent, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(missionsTable)
    .where(and(eq(missionsTable.id, id), eq(missionsTable.parentId, req.session.parentId!))).limit(1);
  if (!existing) { res.status(404).json({ error: "미션을 찾을 수 없어요." }); return; }
  const parsed = CreateMissionBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "입력값을 확인해주세요." }); return; }
  const [updated] = await db.update(missionsTable).set(parsed.data).where(eq(missionsTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/missions/:id
router.delete("/missions/:id", requireParent, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(missionsTable)
    .where(and(eq(missionsTable.id, id), eq(missionsTable.parentId, req.session.parentId!))).limit(1);
  if (!existing) { res.status(404).json({ error: "미션을 찾을 수 없어요." }); return; }
  await db.delete(missionsTable).where(eq(missionsTable.id, id));
  res.json({ ok: true });
});

// POST /api/missions/:id/submit  (child)
router.post("/missions/:id/submit", requireChild, async (req, res) => {
  const missionId = parseInt(req.params.id, 10);
  const childId = req.session.childId!;

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, missionId)).limit(1);
  if (!mission || !mission.isActive) { res.status(404).json({ error: "미션을 찾을 수 없어요." }); return; }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child || child.parentId !== mission.parentId) { res.status(403).json({ error: "권한이 없어요." }); return; }

  // Confirm type → pending
  if (mission.type === "confirm") {
    const [log] = await db.insert(missionLogsTable)
      .values({ missionId, childId, status: "requested" }).returning();
    res.status(201).json({ log, pending: true });
    return;
  }

  // Bible / auto → immediate reward
  const bodyParsed = z.object({
    bibleBook: z.string().optional(),
    bibleChapter: z.number().int().optional(),
  }).safeParse(req.body);
  const { bibleBook, bibleChapter } = bodyParsed.success ? bodyParsed.data : {};

  // Prevent duplicate bible chapter completion
  if (mission.type === "bible" && bibleBook && bibleChapter) {
    const dup = await db.select().from(missionLogsTable).where(
      and(
        eq(missionLogsTable.missionId, missionId),
        eq(missionLogsTable.childId, childId),
        eq(missionLogsTable.bibleBook, bibleBook),
        eq(missionLogsTable.bibleChapter, bibleChapter),
        eq(missionLogsTable.status, "completed"),
      )
    ).limit(1);
    if (dup.length > 0) { res.status(409).json({ error: "이미 완료한 장이에요!" }); return; }
  }

  const newBalance = child.balance + mission.reward;
  await db.update(childrenTable).set({ balance: newBalance }).where(eq(childrenTable.id, childId));

  const description = mission.type === "bible" && bibleBook && bibleChapter
    ? `${bibleBook} ${bibleChapter}장 읽기 완료`
    : `${mission.title} 완료`;

  const [tx] = await db.insert(transactionsTable)
    .values({ childId, amount: mission.reward, description, type: "mission" }).returning();

  const [log] = await db.insert(missionLogsTable)
    .values({ missionId, childId, status: "completed", bibleBook, bibleChapter, transactionId: tx.id }).returning();

  res.status(201).json({ log, tx, childBalance: newBalance });
});

// GET /api/missions/pending  (parent)
router.get("/missions/pending", requireParent, async (req, res) => {
  const parentMissions = await db.select({ id: missionsTable.id })
    .from(missionsTable).where(eq(missionsTable.parentId, req.session.parentId!));
  if (parentMissions.length === 0) { res.json([]); return; }

  const missionIds = parentMissions.map(m => m.id);
  const rows = await db
    .select({ log: missionLogsTable, mission: missionsTable, child: childrenTable })
    .from(missionLogsTable)
    .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
    .innerJoin(childrenTable, eq(missionLogsTable.childId, childrenTable.id))
    .where(and(inArray(missionLogsTable.missionId, missionIds), eq(missionLogsTable.status, "requested")))
    .orderBy(desc(missionLogsTable.requestedAt));

  res.json(rows.map(r => ({
    ...r.log,
    mission: { id: r.mission.id, title: r.mission.title, reward: r.mission.reward, type: r.mission.type },
    child: { id: r.child.id, name: r.child.name, avatar: r.child.avatar },
  })));
});

// POST /api/mission-logs/:logId/approve  (parent)
router.post("/mission-logs/:logId/approve", requireParent, async (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  const [log] = await db.select().from(missionLogsTable).where(eq(missionLogsTable.id, logId)).limit(1);
  if (!log || log.status !== "requested") { res.status(404).json({ error: "대기 중인 미션을 찾을 수 없어요." }); return; }

  const [mission] = await db.select().from(missionsTable)
    .where(and(eq(missionsTable.id, log.missionId), eq(missionsTable.parentId, req.session.parentId!))).limit(1);
  if (!mission) { res.status(403).json({ error: "권한이 없어요." }); return; }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, log.childId)).limit(1);
  if (!child) { res.status(404).json({ error: "아이를 찾을 수 없어요." }); return; }

  const newBalance = child.balance + mission.reward;
  await db.update(childrenTable).set({ balance: newBalance }).where(eq(childrenTable.id, log.childId));

  const [tx] = await db.insert(transactionsTable).values({
    childId: log.childId,
    amount: mission.reward,
    description: `${mission.title} 완료 (부모 확인)`,
    type: "mission",
  }).returning();

  const [updatedLog] = await db
    .update(missionLogsTable)
    .set({ status: "approved", transactionId: tx.id, approvedAt: new Date() })
    .where(eq(missionLogsTable.id, logId))
    .returning();

  res.json({ log: updatedLog, childBalance: newBalance });
});

// POST /api/mission-logs/:logId/reject  (parent)
router.post("/mission-logs/:logId/reject", requireParent, async (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  const [log] = await db.select().from(missionLogsTable).where(eq(missionLogsTable.id, logId)).limit(1);
  if (!log || log.status !== "requested") { res.status(404).json({ error: "대기 중인 미션을 찾을 수 없어요." }); return; }

  const [mission] = await db.select().from(missionsTable)
    .where(and(eq(missionsTable.id, log.missionId), eq(missionsTable.parentId, req.session.parentId!))).limit(1);
  if (!mission) { res.status(403).json({ error: "권한이 없어요." }); return; }

  const [updatedLog] = await db
    .update(missionLogsTable).set({ status: "rejected" })
    .where(eq(missionLogsTable.id, logId)).returning();
  res.json({ log: updatedLog });
});

export default router;
