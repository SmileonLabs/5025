import { Hono } from "hono";
import type { Context } from "hono";
import bcrypt from "bcryptjs";
import { and, desc, eq, exists, gte, inArray, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  childrenTable,
  gifticonCatalogItemsTable,
  gifticonOrdersTable,
  missionAssignmentsTable,
  missionLogsTable,
  missionsTable,
  parentsTable,
  pushSubscriptionsTable,
  requestsTable,
  transactionsTable,
} from "./db";
import { getDatabase } from "./db";
import {
  approveActivityLog,
  completePendingBudgetTopup,
  createGifticonOrder,
  createPendingBudgetTopup,
  creditBudgetTopup,
  fulfillGifticonOrder,
  getTopupByOrder,
  grantBibleReward,
  markGifticonOrderUsed,
  POINTS_PER_KRW,
  refundGifticonOrder,
  TOPUP_KIND,
} from "./credit";
import { corsMiddleware, jsonError, parseId, readJson, type AppContext } from "./http";
import { clearSession, requireAdminSession, requireChild, requireParent, sessionMiddleware, setSession } from "./session";
import {
  confirmTossPayment,
  createSupabaseUploadUrl,
  fetchSupabaseObject,
  generateQuiz,
  getPublicBaseUrl,
  getTossClientKey,
  getVapidPublicKey,
  PaymentProviderError,
  sendPushToParent,
  verifyStripeWebhook,
} from "./services";

const app = new Hono<AppContext>();

app.use("*", corsMiddleware);
app.use("*", sessionMiddleware);

app.get("/api/healthz", (c) => c.json({ status: "ok" }));

const SignupBody = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChildPinBody = z.object({
  childId: z.number().int().positive(),
  pin: z.string().length(4).regex(/^\d{4}$/),
});

app.post("/api/auth/signup", async (c) => {
  const db = getDatabase(c.env);
  const parsed = SignupBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "입력값을 확인해주세요.", { details: parsed.error.issues });
  const { name, email, password } = parsed.data;

  const existing = await db.select().from(parentsTable).where(eq(parentsTable.email, email)).limit(1);
  if (existing.length > 0) return jsonError(c, 409, "이미 사용 중인 이메일이에요.");

  const passwordHash = await bcrypt.hash(password, 12);
  const [parent] = await db
    .insert(parentsTable)
    .values({ name, email, passwordHash, balance: 50000 })
    .returning();

  await setSession(c, { parentId: parent.id });
  return c.json({ id: parent.id, name: parent.name, email: parent.email, balance: parent.balance });
});

app.post("/api/auth/login", async (c) => {
  const db = getDatabase(c.env);
  const parsed = LoginBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "이메일과 비밀번호를 입력해주세요.");
  const { email, password } = parsed.data;

  const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.email, email)).limit(1);
  if (!parent) return jsonError(c, 401, "이메일 또는 비밀번호가 맞지 않아요.");
  const valid = await bcrypt.compare(password, parent.passwordHash);
  if (!valid) return jsonError(c, 401, "이메일 또는 비밀번호가 맞지 않아요.");

  await setSession(c, { parentId: parent.id });
  return c.json({ id: parent.id, name: parent.name, email: parent.email, balance: parent.balance });
});

app.post("/api/auth/child-login", async (c) => {
  const db = getDatabase(c.env);
  const parsed = ChildPinBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "아이 ID와 PIN 4자리를 입력해주세요.");
  const { childId, pin } = parsed.data;

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) return jsonError(c, 404, "아이 계정을 찾을 수 없어요.");
  const valid = await bcrypt.compare(pin, child.pinHash);
  if (!valid) return jsonError(c, 401, "PIN이 맞지 않아요. 다시 시도해보세요!");

  await setSession(c, { childId: child.id });
  return c.json({ id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId });
});

app.post("/api/auth/logout", async (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const db = getDatabase(c.env);
  const session = c.get("session");
  if (session.parentId) {
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, session.parentId)).limit(1);
    if (parent) return c.json({ role: "parent", id: parent.id, name: parent.name, email: parent.email, balance: parent.balance });
  }
  if (session.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, session.childId)).limit(1);
    if (child) return c.json({ role: "child", id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId });
  }
  return jsonError(c, 401, "로그인이 필요해요.");
});

const CreateChildBody = z.object({
  name: z.string().min(1).max(20),
  age: z.number().int().min(1).max(18),
  avatar: z.string().min(1),
  pin: z.string().length(4).regex(/^\d{4}$/),
});

app.get("/api/children", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const db = getDatabase(c.env);
  const children = await db.select().from(childrenTable).where(eq(childrenTable.parentId, parentId));
  return c.json(children.map((child) => ({ id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId })));
});

app.get("/api/children/public", async (c) => {
  const db = getDatabase(c.env);
  const parentEmail = c.req.query("parentEmail");
  if (!parentEmail) return jsonError(c, 400, "parentEmail이 필요해요.");
  const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.email, parentEmail)).limit(1);
  if (!parent) return jsonError(c, 404, "부모 계정을 찾을 수 없어요.");
  const children = await db.select().from(childrenTable).where(eq(childrenTable.parentId, parent.id));
  return c.json(children.map((child) => ({ id: child.id, name: child.name, avatar: child.avatar, parentId: child.parentId })));
});

app.post("/api/children", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const parsed = CreateChildBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "입력값을 확인해주세요.", { details: parsed.error.issues });
  const { name, age, avatar, pin } = parsed.data;
  const db = getDatabase(c.env);
  const pinHash = await bcrypt.hash(pin, 12);
  const [child] = await db.insert(childrenTable).values({ parentId, name, age, avatar, pinHash, balance: 0 }).returning();
  return c.json({ id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId }, 201);
});

app.delete("/api/children/:id", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, id)).limit(1);
  if (!child || child.parentId !== parentId) return jsonError(c, 404, "아이 계정을 찾을 수 없어요.");
  await db.delete(childrenTable).where(eq(childrenTable.id, id));
  return c.json({ ok: true });
});

app.get("/api/children/:id/transactions", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [child] = await db.select().from(childrenTable).where(and(eq(childrenTable.id, id), eq(childrenTable.parentId, parentId))).limit(1);
  if (!child) return jsonError(c, 404, "아이 계정을 찾을 수 없어요.");
  const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.childId, id)).orderBy(desc(transactionsTable.createdAt));
  return c.json(txs);
});

const CreateTxBody = z.object({
  childId: z.number().int().positive(),
  amount: z.number().int(),
  description: z.string().min(1),
  type: z.enum(["mission", "charge", "spend"]),
  category: z.string().max(50).optional(),
});

app.get("/api/transactions", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const db = getDatabase(c.env);
  const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.childId, childId)).orderBy(desc(transactionsTable.createdAt));
  return c.json(txs);
});

app.get("/api/transactions/all", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모님 로그인이 필요해요.");
  const db = getDatabase(c.env);
  const kids = await db.select({ id: childrenTable.id }).from(childrenTable).where(eq(childrenTable.parentId, parentId));
  const childIds = kids.map((kid) => kid.id);
  if (childIds.length === 0) return c.json([]);
  const txs = await db.select().from(transactionsTable).where(inArray(transactionsTable.childId, childIds)).orderBy(desc(transactionsTable.createdAt));
  return c.json(txs);
});

app.get("/api/transactions/:id", async (c) => {
  const session = c.get("session");
  if (!session.parentId && !session.childId) return jsonError(c, 401, "로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) return jsonError(c, 404, "거래 내역을 찾을 수 없어요.");
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, tx.childId)).limit(1);
  if (!child) return jsonError(c, 404, "거래 내역을 찾을 수 없어요.");
  if (session.parentId !== child.parentId && session.childId !== tx.childId) return jsonError(c, 403, "권한이 없어요.");

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
        quiz: row.log.quiz,
        photoUrl: row.log.photoUrl,
        status: row.log.status,
        completedAt: row.log.approvedAt ?? row.log.createdAt,
      };
    }
  }

  return c.json({ ...tx, child: { id: child.id, name: child.name, avatar: child.avatar }, mission });
});

app.post("/api/transactions", async (c) => {
  const parsed = CreateTxBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "입력값을 확인해주세요.");
  const { childId, amount, description, type, category } = parsed.data;
  const session = c.get("session");
  const db = getDatabase(c.env);

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) return jsonError(c, 404, "아이를 찾을 수 없어요.");
  const isParent = session.parentId === child.parentId;
  const isChild = session.childId === childId;
  if (!isParent && !isChild) return jsonError(c, 403, "권한이 없어요.");
  if (type === "mission") return jsonError(c, 403, "미션 보상은 직접 등록할 수 없어요.");

  if (type === "charge") {
    if (!isParent || !session.parentId) return jsonError(c, 403, "용돈 충전은 부모님만 할 수 있어요.");
    if (amount <= 0) return jsonError(c, 400, "충전 금액은 0보다 커야 해요.");
  }
  if (type === "spend") {
    if (amount >= 0) return jsonError(c, 400, "사용 금액이 올바르지 않아요.");
    if (child.balance + amount < 0) return jsonError(c, 400, "잔액이 부족해요.");
  }

  const result = await db.transaction(async (txdb) => {
    if (type === "charge") {
      const [parent] = await txdb
        .update(parentsTable)
        .set({ balance: sql`${parentsTable.balance} - ${amount}` })
        .where(and(eq(parentsTable.id, session.parentId!), gte(parentsTable.balance, amount)))
        .returning();
      if (!parent) return null;
    }
    const [updatedChild] = await txdb
      .update(childrenTable)
      .set({ balance: sql`${childrenTable.balance} + ${amount}` })
      .where(eq(childrenTable.id, childId))
      .returning();
    const [txRow] = await txdb
      .insert(transactionsTable)
      .values({ childId, amount, description, type, category: category ?? null })
      .returning();
    return { tx: txRow, childBalance: updatedChild.balance };
  });

  if (!result) return jsonError(c, 400, "부모님 잔액이 부족해요.");
  if (type === "spend") {
    sendPushToParent(c.env, child.parentId, {
      title: "용돈 사용",
      body: `${child.name}님이 ${Math.abs(amount).toLocaleString()}원을 사용했어요. (${description})`,
    });
  }
  return c.json({ ...result.tx, childBalance: result.childBalance }, 201);
});

const MissionFields = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  type: z.enum(["bible", "activity"]),
  reward: z.number().int().min(0).max(100000),
  scheduleType: z.enum(["daily", "weekly", "once"]).default("daily"),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  weeklyDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  timeLimit: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  requiresPhoto: z.boolean().default(false),
  assignToAll: z.boolean().default(true),
  childIds: z.array(z.number().int().positive()).optional(),
  isActive: z.boolean().default(true),
});

const CreateMissionBody = MissionFields.refine((v) => v.scheduleType !== "once" || !!v.scheduledDate, {
  message: "지정일을 선택해주세요.",
  path: ["scheduledDate"],
}).refine((v) => v.scheduleType !== "weekly" || v.weeklyDays.length > 0, {
  message: "수행할 요일을 하나 이상 선택해주세요.",
  path: ["weeklyDays"],
}).refine((v) => v.assignToAll || (v.childIds != null && v.childIds.length > 0), {
  message: "대상 아이를 선택해주세요.",
  path: ["childIds"],
});

const UpdateMissionBody = MissionFields.partial().refine((v) => v.scheduleType !== "once" || v.scheduledDate != null, {
  message: "지정일을 선택해주세요.",
  path: ["scheduledDate"],
}).refine((v) => v.scheduleType !== "weekly" || (v.weeklyDays != null && v.weeklyDays.length > 0), {
  message: "수행할 요일을 하나 이상 선택해주세요.",
  path: ["weeklyDays"],
}).refine((v) => v.assignToAll !== false || (v.childIds != null && v.childIds.length > 0), {
  message: "대상 아이를 선택해주세요.",
  path: ["childIds"],
}).refine((v) => v.childIds === undefined || v.assignToAll !== undefined, {
  message: "대상을 바꾸려면 assignToAll을 함께 보내주세요.",
  path: ["assignToAll"],
});

async function resolveOwnedChildIds(db: ReturnType<typeof getDatabase>, parentId: number, childIds: number[]): Promise<number[] | null> {
  const uniqueIds = [...new Set(childIds)];
  if (uniqueIds.length === 0) return null;
  const owned = await db
    .select({ id: childrenTable.id })
    .from(childrenTable)
    .where(and(eq(childrenTable.parentId, parentId), inArray(childrenTable.id, uniqueIds)));
  return owned.length === uniqueIds.length ? uniqueIds : null;
}

app.get("/api/missions", async (c) => {
  const db = getDatabase(c.env);
  const session = c.get("session");
  if (session.parentId) {
    const missions = await db.select().from(missionsTable).where(eq(missionsTable.parentId, session.parentId)).orderBy(desc(missionsTable.createdAt));
    const scopedIds = missions.filter((m) => !m.assignToAll).map((m) => m.id);
    const assignMap = new Map<number, number[]>();
    if (scopedIds.length > 0) {
      const rows = await db
        .select({ missionId: missionAssignmentsTable.missionId, childId: missionAssignmentsTable.childId })
        .from(missionAssignmentsTable)
        .where(inArray(missionAssignmentsTable.missionId, scopedIds));
      for (const row of rows) {
        const arr = assignMap.get(row.missionId) ?? [];
        arr.push(row.childId);
        assignMap.set(row.missionId, arr);
      }
    }
    return c.json(missions.map((m) => ({ ...m, assignedChildIds: m.assignToAll ? [] : assignMap.get(m.id) ?? [] })));
  }
  if (session.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, session.childId)).limit(1);
    if (!child) return jsonError(c, 404, "아이를 찾을 수 없어요.");
    const missions = await db
      .select()
      .from(missionsTable)
      .where(
        and(
          eq(missionsTable.parentId, child.parentId),
          eq(missionsTable.isActive, true),
          or(
            eq(missionsTable.assignToAll, true),
            exists(
              db
                .select({ one: sql`1` })
                .from(missionAssignmentsTable)
                .where(and(eq(missionAssignmentsTable.missionId, missionsTable.id), eq(missionAssignmentsTable.childId, child.id))),
            ),
          ),
        ),
      )
      .orderBy(desc(missionsTable.createdAt));
    return c.json(missions);
  }
  return jsonError(c, 401, "로그인이 필요해요.");
});

app.post("/api/missions", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const db = getDatabase(c.env);
  const parsed = CreateMissionBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  const { childIds, assignToAll, ...missionData } = parsed.data;
  if (missionData.scheduleType !== "once") missionData.scheduledDate = null;
  if (missionData.scheduleType !== "weekly") missionData.weeklyDays = [];

  let validChildIds: number[] = [];
  if (!assignToAll) {
    const resolved = await resolveOwnedChildIds(db, parentId, childIds ?? []);
    if (!resolved) return jsonError(c, 400, "대상 아이가 올바르지 않아요.");
    validChildIds = resolved;
  }

  const mission = await db.transaction(async (tx) => {
    const [m] = await tx.insert(missionsTable).values({ parentId, assignToAll, ...missionData }).returning();
    if (!assignToAll && validChildIds.length > 0) {
      await tx.insert(missionAssignmentsTable).values(validChildIds.map((childId) => ({ missionId: m.id, childId })));
    }
    return m;
  });
  return c.json({ ...mission, assignedChildIds: assignToAll ? [] : validChildIds }, 201);
});

app.patch("/api/missions/:id", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [existing] = await db.select().from(missionsTable).where(and(eq(missionsTable.id, id), eq(missionsTable.parentId, parentId))).limit(1);
  if (!existing) return jsonError(c, 404, "미션을 찾을 수 없어요.");
  const parsed = UpdateMissionBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  const { childIds, assignToAll, ...missionData } = parsed.data;
  const effectiveSchedule = missionData.scheduleType ?? existing.scheduleType;
  if (missionData.scheduleType !== undefined && effectiveSchedule !== "once") missionData.scheduledDate = null;
  if (missionData.scheduleType !== undefined && effectiveSchedule !== "weekly") missionData.weeklyDays = [];

  let validChildIds: number[] = [];
  if (assignToAll === false) {
    const resolved = await resolveOwnedChildIds(db, parentId, childIds ?? []);
    if (!resolved) return jsonError(c, 400, "대상 아이가 올바르지 않아요.");
    validChildIds = resolved;
  }

  const updated = await db.transaction(async (tx) => {
    const setData: Record<string, unknown> = { ...missionData };
    if (assignToAll !== undefined) setData.assignToAll = assignToAll;
    let row = existing;
    if (Object.keys(setData).length > 0) {
      [row] = await tx.update(missionsTable).set(setData).where(eq(missionsTable.id, id)).returning();
    }
    if (assignToAll === true) {
      await tx.delete(missionAssignmentsTable).where(eq(missionAssignmentsTable.missionId, id));
    } else if (assignToAll === false) {
      await tx.delete(missionAssignmentsTable).where(eq(missionAssignmentsTable.missionId, id));
      if (validChildIds.length > 0) await tx.insert(missionAssignmentsTable).values(validChildIds.map((childId) => ({ missionId: id, childId })));
    }
    return row;
  });

  const assignedChildIds = updated.assignToAll
    ? []
    : (await db.select({ childId: missionAssignmentsTable.childId }).from(missionAssignmentsTable).where(eq(missionAssignmentsTable.missionId, id))).map((a) => a.childId);
  return c.json({ ...updated, assignedChildIds });
});

app.delete("/api/missions/:id", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [existing] = await db.select().from(missionsTable).where(and(eq(missionsTable.id, id), eq(missionsTable.parentId, parentId))).limit(1);
  if (!existing) return jsonError(c, 404, "미션을 찾을 수 없어요.");
  await db.delete(missionsTable).where(eq(missionsTable.id, id));
  return c.json({ ok: true });
});

app.post("/api/missions/:id/submit", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const missionId = parseId(c.req.param("id"));
  if (!missionId) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const body = (await readJson(c)) as Record<string, unknown> | undefined;

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, missionId)).limit(1);
  if (!mission || !mission.isActive) return jsonError(c, 404, "미션을 찾을 수 없어요.");
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child || child.parentId !== mission.parentId) return jsonError(c, 403, "권한이 없어요.");

  if (!mission.assignToAll) {
    const [assigned] = await db
      .select({ id: missionAssignmentsTable.id })
      .from(missionAssignmentsTable)
      .where(and(eq(missionAssignmentsTable.missionId, missionId), eq(missionAssignmentsTable.childId, childId)))
      .limit(1);
    if (!assigned) return jsonError(c, 403, "이 미션의 대상이 아니에요.");
  }

  if (mission.type === "activity") {
    const actBody = z.object({
      photoUrl: z.string().startsWith("/objects/").max(500).optional(),
      reflection: z.string().trim().max(500).optional(),
    }).safeParse(body);
    const photoUrl = actBody.success ? actBody.data.photoUrl : undefined;
    const activityNote = actBody.success ? actBody.data.reflection : undefined;
    if (mission.requiresPhoto && !photoUrl) return jsonError(c, 400, "인증샷을 올려주세요.");
    if (!mission.requiresPhoto && (!activityNote || activityNote.length < 5)) return jsonError(c, 400, "완료한 내용을 5자 이상 적어주세요.");

    if (mission.timeLimit) {
      const nowKstHHMM = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
      if (nowKstHHMM > mission.timeLimit) return jsonError(c, 409, `마감 시간(${mission.timeLimit})이 지났어요.`);
    }

    const todayKst = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (mission.scheduleType === "once" && mission.scheduledDate) {
      if (mission.scheduledDate !== todayKst) return jsonError(c, 409, `이 미션은 ${mission.scheduledDate}에 할 수 있어요.`);
    }
    if (mission.scheduleType === "weekly") {
      const weekday = new Date(`${todayKst}T00:00:00Z`).getUTCDay();
      if (!mission.weeklyDays.includes(weekday)) return jsonError(c, 409, "오늘은 이 미션을 하는 요일이 아니에요.");
    }

    const dupConds = [
      eq(missionLogsTable.missionId, missionId),
      eq(missionLogsTable.childId, childId),
      inArray(missionLogsTable.status, ["requested", "approved"]),
    ];
    if (mission.scheduleType !== "once") {
      dupConds.push(sql`(${missionLogsTable.createdAt} AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date`);
    }
    const dup = await db.select({ id: missionLogsTable.id }).from(missionLogsTable).where(and(...dupConds)).limit(1);
    if (dup.length > 0) {
      return jsonError(c, 409, mission.scheduleType !== "once" ? "오늘은 이미 완료 요청했어요." : "이미 완료 요청한 미션이에요.");
    }

    const [log] = await db.insert(missionLogsTable).values({ missionId, childId, status: "requested", photoUrl: photoUrl ?? null, reflection: activityNote ?? null }).returning();
    sendPushToParent(c.env, child.parentId, {
      title: "미션 승인 요청",
      body: `${child.name}님이 '${mission.title}' 미션을 완료했어요. 승인하면 ${mission.reward.toLocaleString("ko-KR")}P가 지급돼요.`,
    });
    return c.json({ log, pending: true }, 201);
  }

  const bodyParsed = z.object({
    bibleBook: z.string().optional(),
    bibleChapter: z.number().int().optional(),
    reflection: z.string().optional(),
  }).safeParse(body);
  const { bibleBook, bibleChapter, reflection } = bodyParsed.success ? bodyParsed.data : {};
  const quizParsed = z.array(z.object({
    question: z.string().min(1).max(500),
    options: z.array(z.string().max(200)).min(2).max(6),
    correctIndex: z.number().int().min(0),
  }).refine((q) => q.correctIndex < q.options.length)).max(5).safeParse(body?.quiz);
  const quiz = quizParsed.success ? quizParsed.data : undefined;

  if (!bibleBook || !bibleChapter) return jsonError(c, 400, "성경 책과 장 정보가 필요해요.");
  if (!reflection || reflection.trim().length < 5) return jsonError(c, 400, "묵상 내용을 5자 이상 적어주세요.");

  const dup = await db.select().from(missionLogsTable).where(
    and(
      eq(missionLogsTable.missionId, missionId),
      eq(missionLogsTable.childId, childId),
      eq(missionLogsTable.bibleBook, bibleBook),
      eq(missionLogsTable.bibleChapter, bibleChapter),
      eq(missionLogsTable.status, "completed"),
    ),
  ).limit(1);
  if (dup.length > 0) return jsonError(c, 409, "이미 완료한 장이에요!");

  const result = await grantBibleReward(db, {
    parentId: child.parentId,
    childId,
    missionId,
    reward: mission.reward,
    bibleBook,
    bibleChapter,
    reflection,
    quiz,
    description: `${bibleBook} ${bibleChapter}장 읽기 완료`,
  });

  if (!result.ok) {
    if (result.reason === "duplicate") return jsonError(c, 409, "이미 완료한 장이에요!");
    sendPushToParent(c.env, child.parentId, {
      title: "미션 보상 지급 실패",
      body: `${child.name}님이 '${mission.title}' 미션을 완료했지만 포인트가 부족해 보상을 못 줬어요.`,
    });
    return jsonError(c, 402, "부모님 포인트가 부족해 지금은 보상을 받을 수 없어요. 부모님께 충전을 부탁해요.");
  }

  sendPushToParent(c.env, child.parentId, {
    title: "미션 완료!",
    body: `${child.name}님이 '${mission.title}' 미션을 완료하고 ${mission.reward.toLocaleString("ko-KR")}P를 받았어요.`,
  });
  return c.json({ log: result.log, tx: result.tx, childBalance: result.childBalance }, 201);
});

app.get("/api/missions/pending", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const db = getDatabase(c.env);
  const parentMissions = await db.select({ id: missionsTable.id }).from(missionsTable).where(eq(missionsTable.parentId, parentId));
  if (parentMissions.length === 0) return c.json([]);
  const missionIds = parentMissions.map((m) => m.id);
  const rows = await db
    .select({ log: missionLogsTable, mission: missionsTable, child: childrenTable })
    .from(missionLogsTable)
    .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
    .innerJoin(childrenTable, eq(missionLogsTable.childId, childrenTable.id))
    .where(and(inArray(missionLogsTable.missionId, missionIds), eq(missionLogsTable.status, "requested")))
    .orderBy(desc(missionLogsTable.requestedAt));
  return c.json(rows.map((r) => ({
    ...r.log,
    mission: { id: r.mission.id, title: r.mission.title, reward: r.mission.reward, type: r.mission.type },
    child: { id: r.child.id, name: r.child.name, avatar: r.child.avatar },
  })));
});

app.get("/api/mission-logs", async (c) => {
  const db = getDatabase(c.env);
  const session = c.get("session");
  if (session.parentId) {
    const parentMissions = await db.select({ id: missionsTable.id }).from(missionsTable).where(eq(missionsTable.parentId, session.parentId));
    if (parentMissions.length === 0) return c.json([]);
    const missionIds = parentMissions.map((m) => m.id);
    const rows = await db
      .select({ log: missionLogsTable, mission: missionsTable, child: childrenTable, txAmount: transactionsTable.amount })
      .from(missionLogsTable)
      .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
      .innerJoin(childrenTable, eq(missionLogsTable.childId, childrenTable.id))
      .leftJoin(transactionsTable, eq(missionLogsTable.transactionId, transactionsTable.id))
      .where(inArray(missionLogsTable.missionId, missionIds))
      .orderBy(desc(missionLogsTable.createdAt));
    return c.json(rows.map((r) => ({
      ...r.log,
      rewardAmount: r.log.transactionId != null && r.txAmount != null ? r.txAmount : r.mission.reward,
      mission: { id: r.mission.id, title: r.mission.title, type: r.mission.type, reward: r.mission.reward, scheduleType: r.mission.scheduleType },
      child: { id: r.child.id, name: r.child.name, avatar: r.child.avatar },
    })));
  }
  if (session.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, session.childId)).limit(1);
    if (!child) return jsonError(c, 404, "아이를 찾을 수 없어요.");
    const rows = await db
      .select({ log: missionLogsTable, mission: missionsTable, txAmount: transactionsTable.amount })
      .from(missionLogsTable)
      .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
      .leftJoin(transactionsTable, eq(missionLogsTable.transactionId, transactionsTable.id))
      .where(eq(missionLogsTable.childId, child.id))
      .orderBy(desc(missionLogsTable.createdAt));
    return c.json(rows.map((r) => ({
      ...r.log,
      rewardAmount: r.log.transactionId != null && r.txAmount != null ? r.txAmount : r.mission.reward,
      mission: { id: r.mission.id, title: r.mission.title, type: r.mission.type, reward: r.mission.reward, scheduleType: r.mission.scheduleType },
    })));
  }
  return jsonError(c, 401, "로그인이 필요해요.");
});

app.post("/api/mission-logs/:logId/approve", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const logId = parseId(c.req.param("logId"));
  if (!logId) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [log] = await db.select().from(missionLogsTable).where(eq(missionLogsTable.id, logId)).limit(1);
  if (!log || log.status !== "requested") return jsonError(c, 404, "대기 중인 미션을 찾을 수 없어요.");
  const [mission] = await db.select().from(missionsTable).where(and(eq(missionsTable.id, log.missionId), eq(missionsTable.parentId, parentId))).limit(1);
  if (!mission) return jsonError(c, 403, "권한이 없어요.");
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, log.childId)).limit(1);
  if (!child) return jsonError(c, 404, "아이를 찾을 수 없어요.");
  const result = await approveActivityLog(db, {
    logId,
    parentId: mission.parentId,
    childId: log.childId,
    reward: mission.reward,
    description: `${mission.title} 완료 (부모 확인)`,
  });
  if (!result.ok) {
    if (result.reason === "already_processed") return jsonError(c, 409, "이미 처리된 미션이에요.");
    return jsonError(c, 402, "포인트가 부족해요. 충전 후 다시 승인해주세요.");
  }
  return c.json({ log: result.log, childBalance: result.childBalance, parentBalance: result.parentBalance });
});

app.post("/api/mission-logs/:logId/reject", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const logId = parseId(c.req.param("logId"));
  if (!logId) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [log] = await db.select().from(missionLogsTable).where(eq(missionLogsTable.id, logId)).limit(1);
  if (!log || log.status !== "requested") return jsonError(c, 404, "대기 중인 미션을 찾을 수 없어요.");
  const [mission] = await db.select().from(missionsTable).where(and(eq(missionsTable.id, log.missionId), eq(missionsTable.parentId, parentId))).limit(1);
  if (!mission) return jsonError(c, 403, "권한이 없어요.");
  const [updatedLog] = await db
    .update(missionLogsTable)
    .set({ status: "rejected" })
    .where(and(eq(missionLogsTable.id, logId), eq(missionLogsTable.status, "requested")))
    .returning();
  if (!updatedLog) return jsonError(c, 409, "이미 처리된 미션이에요.");
  return c.json({ log: updatedLog });
});

function toGifticonListItem(order: typeof gifticonOrdersTable.$inferSelect) {
  const { issuedPin: _p, issuedBarcode: _b, issuedImageUrl: _i, ...rest } = order;
  return rest;
}

const CatalogItemBody = z.object({
  brand: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(1).max(100),
  price: z.number().int().min(0).max(10_000_000),
  isVariablePrice: z.boolean().optional().default(false),
  emoji: z.string().trim().min(1).max(20).optional(),
}).refine((v) => v.isVariablePrice || v.price >= 1, { message: "가격을 입력해주세요.", path: ["price"] });

app.get("/api/gifticons/catalog", async (c) => {
  const db = getDatabase(c.env);
  const session = c.get("session");
  let parentId: number | undefined;
  if (session.childId) {
    const [child] = await db.select({ parentId: childrenTable.parentId }).from(childrenTable).where(eq(childrenTable.id, session.childId)).limit(1);
    parentId = child?.parentId;
  } else if (session.parentId) {
    parentId = session.parentId;
  }
  if (parentId === undefined) return jsonError(c, 401, "로그인이 필요해요.");
  const items = await db.select().from(gifticonCatalogItemsTable).where(eq(gifticonCatalogItemsTable.parentId, parentId)).orderBy(desc(gifticonCatalogItemsTable.createdAt));
  return c.json(items);
});

app.post("/api/gifticons/catalog", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const parsed = CatalogItemBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  const { brand, productName, price, isVariablePrice, emoji } = parsed.data;
  const db = getDatabase(c.env);
  const [item] = await db.insert(gifticonCatalogItemsTable).values({
    parentId,
    brand,
    productName,
    price: isVariablePrice ? 0 : price,
    isVariablePrice,
    ...(emoji ? { emoji } : {}),
  }).returning();
  return c.json(item, 201);
});

app.delete("/api/gifticons/catalog/:id", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [deleted] = await db.delete(gifticonCatalogItemsTable).where(and(eq(gifticonCatalogItemsTable.id, id), eq(gifticonCatalogItemsTable.parentId, parentId))).returning();
  if (!deleted) return jsonError(c, 404, "상품을 찾을 수 없어요.");
  return c.json({ ok: true });
});

app.post("/api/gifticons/orders", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const parsed = z.object({ catalogItemId: z.string().min(1), amount: z.number().int().min(1).max(10_000_000).optional() }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "상품을 선택해주세요.");
  const itemId = Number(parsed.data.catalogItemId);
  if (!Number.isInteger(itemId)) return jsonError(c, 400, "판매하지 않는 상품이에요.");
  const db = getDatabase(c.env);

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) return jsonError(c, 404, "아이를 찾을 수 없어요.");
  const [dbItem] = await db.select().from(gifticonCatalogItemsTable).where(and(eq(gifticonCatalogItemsTable.id, itemId), eq(gifticonCatalogItemsTable.parentId, child.parentId))).limit(1);
  if (!dbItem) return jsonError(c, 400, "판매하지 않는 상품이에요.");

  const faceValue = dbItem.isVariablePrice ? parsed.data.amount : dbItem.price;
  if (faceValue === undefined) return jsonError(c, 400, "금액을 입력해주세요.");

  const result = await createGifticonOrder(db, {
    childId: child.id,
    parentId: child.parentId,
    item: {
      id: String(dbItem.id),
      brand: dbItem.brand,
      productName: dbItem.productName,
      faceValue,
      price: faceValue,
      emoji: dbItem.emoji,
    },
  });
  if (!result.ok) return jsonError(c, 400, "잔액이 부족해요.");
  sendPushToParent(c.env, child.parentId, {
    title: "기프티콘 구매 요청",
    body: `${child.name}님이 ${dbItem.brand} ${dbItem.productName}을(를) 구매했어요.`,
    url: "/",
  });
  return c.json({ order: result.order, childBalance: result.childBalance }, 201);
});

app.get("/api/gifticons/orders", async (c) => {
  const db = getDatabase(c.env);
  const session = c.get("session");
  if (session.childId) {
    const rows = await db.select().from(gifticonOrdersTable).where(eq(gifticonOrdersTable.childId, session.childId)).orderBy(desc(gifticonOrdersTable.createdAt));
    return c.json(rows.map(toGifticonListItem));
  }
  if (session.parentId) {
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
        usedAt: gifticonOrdersTable.usedAt,
        createdAt: gifticonOrdersTable.createdAt,
        childName: childrenTable.name,
        childAvatar: childrenTable.avatar,
      })
      .from(gifticonOrdersTable)
      .innerJoin(childrenTable, eq(gifticonOrdersTable.childId, childrenTable.id))
      .where(eq(gifticonOrdersTable.parentId, session.parentId))
      .orderBy(desc(gifticonOrdersTable.createdAt));
    return c.json(rows);
  }
  return jsonError(c, 401, "로그인이 필요해요.");
});

app.get("/api/gifticons/orders/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  const [order] = await db.select().from(gifticonOrdersTable).where(eq(gifticonOrdersTable.id, id)).limit(1);
  if (!order) return jsonError(c, 404, "주문을 찾을 수 없어요.");
  const session = c.get("session");
  const isOwnerChild = session.childId === order.childId;
  const isParent = session.parentId === order.parentId;
  const isAdmin = session.isAdmin === true;
  if (!isOwnerChild && !isParent && !isAdmin) return jsonError(c, 403, "권한이 없어요.");
  return c.json(order);
});

app.post("/api/gifticons/orders/:id/cancel", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const result = await refundGifticonOrder(getDatabase(c.env), { orderId: id, newStatus: "canceled", requireChildId: childId });
  if (!result.ok) return jsonError(c, 409, "취소할 수 없는 주문이에요.");
  return c.json({ order: result.order, childBalance: result.childBalance });
});

app.post("/api/gifticons/orders/:id/use", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const order = await markGifticonOrderUsed(getDatabase(c.env), { orderId: id, childId });
  if (!order) return jsonError(c, 409, "사용 완료할 수 없는 기프티콘이에요.");
  return c.json(toGifticonListItem(order));
});

const ParentFulfillBody = z.object({
  issuedPin: z.string().trim().max(200).optional(),
  issuedBarcode: z.string().trim().max(200).optional(),
  issuedImageUrl: z.string().trim().url().regex(/^https?:\/\//i, "http(s) URL만 허용해요").max(2000).optional(),
});

app.patch("/api/gifticons/orders/:id/fulfill", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const parsed = ParentFulfillBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "입력값을 확인해주세요.");
  const order = await fulfillGifticonOrder(getDatabase(c.env), {
    orderId: id,
    requireParentId: parentId,
    ...parsed.data,
    markUsed: true,
  });
  if (!order) return jsonError(c, 409, "발급할 수 없는 주문이에요.");
  return c.json(order);
});

const ParentRejectBody = z.object({ reason: z.string().trim().max(500).optional() });

app.patch("/api/gifticons/orders/:id/reject", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const parsed = ParentRejectBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "입력값을 확인해주세요.");
  const result = await refundGifticonOrder(getDatabase(c.env), { orderId: id, newStatus: "rejected", rejectReason: parsed.data.reason ?? null, requireParentId: parentId });
  if (!result.ok) return jsonError(c, 409, "거절할 수 없는 주문이에요.");
  return c.json({ order: result.order, childBalance: result.childBalance });
});

function passwordMatches(input: string, expected: string): boolean {
  if (input.length !== expected.length) return false;
  let out = 0;
  for (let i = 0; i < input.length; i += 1) out |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  return out === 0;
}

function requireAdmin(c: Context<AppContext>) {
  if (!c.env.ADMIN_PASSWORD) return jsonError(c, 503, "운영자 기능이 아직 설정되지 않았어요.");
  if (!requireAdminSession(c)) return jsonError(c, 401, "운영자 로그인이 필요해요.");
  return null;
}

app.post("/api/admin/login", async (c) => {
  const adminPw = c.env.ADMIN_PASSWORD;
  if (!adminPw) return jsonError(c, 503, "운영자 기능이 아직 설정되지 않았어요.");
  const parsed = z.object({ password: z.string().min(1) }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "비밀번호를 입력해주세요.");
  if (!passwordMatches(parsed.data.password, adminPw)) return jsonError(c, 401, "비밀번호가 맞지 않아요.");
  await setSession(c, { isAdmin: true });
  return c.json({ ok: true });
});

app.post("/api/admin/logout", async (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

app.get("/api/admin/me", (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  return c.json({ isAdmin: true });
});

app.get("/api/gifticons/admin/orders", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const rows = await getDatabase(c.env)
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
      usedAt: gifticonOrdersTable.usedAt,
      createdAt: gifticonOrdersTable.createdAt,
      childName: childrenTable.name,
      childAvatar: childrenTable.avatar,
    })
    .from(gifticonOrdersTable)
    .innerJoin(childrenTable, eq(gifticonOrdersTable.childId, childrenTable.id))
    .orderBy(desc(gifticonOrdersTable.createdAt));
  return c.json(rows);
});

const AdminFulfillBody = ParentFulfillBody.refine((v) => v.issuedPin || v.issuedBarcode || v.issuedImageUrl, {
  message: "핀번호, 바코드, 이미지 중 하나는 입력해야 해요.",
});

app.patch("/api/gifticons/admin/orders/:id/fulfill", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const parsed = AdminFulfillBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  const order = await fulfillGifticonOrder(getDatabase(c.env), { orderId: id, ...parsed.data });
  if (!order) return jsonError(c, 409, "발급할 수 없는 주문이에요.");
  sendPushToParent(c.env, order.parentId, {
    title: "기프티콘 발급 완료",
    body: `${order.brand} ${order.productName} 기프티콘이 발급되었어요.`,
    url: "/",
  });
  return c.json(order);
});

app.patch("/api/gifticons/admin/orders/:id/reject", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const parsed = ParentRejectBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "입력값을 확인해주세요.");
  const result = await refundGifticonOrder(getDatabase(c.env), { orderId: id, newStatus: "rejected", rejectReason: parsed.data.reason ?? null });
  if (!result.ok) return jsonError(c, 409, "거절할 수 없는 주문이에요.");
  sendPushToParent(c.env, result.order.parentId, {
    title: "기프티콘 구매 취소",
    body: `${result.order.brand} ${result.order.productName} 구매가 취소되어 ${result.order.price.toLocaleString("ko-KR")}P가 환불되었어요.`,
    url: "/",
  });
  return c.json({ order: result.order, childBalance: result.childBalance });
});

const CreateRequestBody = z.object({
  type: z.enum(["allowance", "mission", "message"]),
  message: z.string().min(1).max(500),
});

app.post("/api/requests", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const parsed = CreateRequestBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "요청 내용을 확인해주세요.");
  const db = getDatabase(c.env);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) return jsonError(c, 404, "아이를 찾을 수 없어요.");
  const [request] = await db.insert(requestsTable).values({ childId: child.id, parentId: child.parentId, type: parsed.data.type, message: parsed.data.message }).returning();
  return c.json(request, 201);
});

app.get("/api/requests", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모님 로그인이 필요해요.");
  const rows = await getDatabase(c.env)
    .select({
      id: requestsTable.id,
      childId: requestsTable.childId,
      type: requestsTable.type,
      message: requestsTable.message,
      status: requestsTable.status,
      createdAt: requestsTable.createdAt,
      childName: childrenTable.name,
      childAvatar: childrenTable.avatar,
    })
    .from(requestsTable)
    .innerJoin(childrenTable, eq(requestsTable.childId, childrenTable.id))
    .where(and(eq(requestsTable.parentId, parentId), eq(requestsTable.status, "pending")))
    .orderBy(desc(requestsTable.createdAt));
  return c.json(rows);
});

app.patch("/api/requests/:id", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모님 로그인이 필요해요.");
  const id = parseId(c.req.param("id"));
  if (!id) return jsonError(c, 400, "잘못된 요청이에요.");
  const parsed = z.object({ status: z.enum(["resolved", "dismissed"]) }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "상태값을 확인해주세요.");
  const db = getDatabase(c.env);
  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, id)).limit(1);
  if (!request || request.parentId !== parentId) return jsonError(c, 404, "요청을 찾을 수 없어요.");
  const [updated] = await db.update(requestsTable).set({ status: parsed.data.status }).where(eq(requestsTable.id, id)).returning();
  return c.json(updated);
});

app.get("/api/push/public-key", (c) => {
  const key = getVapidPublicKey(c.env);
  if (!key) return jsonError(c, 503, "푸시 알림이 설정되지 않았어요.");
  return c.json({ publicKey: key });
});

app.post("/api/push/subscribe", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모님 로그인이 필요해요.");
  const parsed = z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "구독 정보를 확인해주세요.");
  const { endpoint, keys } = parsed.data;
  const db = getDatabase(c.env);
  const [existing] = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint)).limit(1);
  if (existing) {
    await db.update(pushSubscriptionsTable).set({ parentId, p256dh: keys.p256dh, auth: keys.auth }).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptionsTable).values({ parentId, endpoint, p256dh: keys.p256dh, auth: keys.auth });
  }
  return c.json({ ok: true }, 201);
});

app.post("/api/push/unsubscribe", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모님 로그인이 필요해요.");
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "구독 정보를 확인해주세요.");
  await getDatabase(c.env).delete(pushSubscriptionsTable).where(and(eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint), eq(pushSubscriptionsTable.parentId, parentId)));
  return c.json({ ok: true });
});

app.post("/api/quiz/generate", async (c) => {
  const parsed = z.object({
    passage: z.string().min(1),
    bookName: z.string().min(1),
  }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "passage와 bookName이 필요합니다.");
  const { passage, bookName } = parsed.data;

  const prompt = `당신은 초등학생(7-10세) 아이들을 위한 성경 교육 전문가입니다.
아이가 방금 "${passage}"(${bookName})를 읽었습니다.

다음 규칙에 따라 해당 성경 구절에 관한 퀴즈 2개를 만들어주세요:
- 7-10세 아이가 이해할 수 있는 쉽고 재미있는 문장으로 작성
- 각 문제는 4개의 선택지(객관식)로 구성
- 정답은 반드시 명확하게 1개만 존재
- 성경 내용에 충실하되, 너무 어렵지 않게

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "questions": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctIndex": 0
    },
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctIndex": 2
    }
  ]
}`;

  try {
    const content = await generateQuiz(c.env, prompt);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return jsonError(c, 500, "퀴즈 생성에 실패했습니다.");
    return c.json(JSON.parse(jsonMatch[0]));
  } catch {
    return jsonError(c, 500, "퀴즈 생성 중 오류가 발생했습니다.");
  }
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

app.post("/api/storage/uploads/request-url", async (c) => {
  const childId = requireChild(c);
  if (!childId) return jsonError(c, 401, "아이 로그인이 필요해요.");
  const parsed = z.object({
    contentType: z.string().regex(/^image\//i, "이미지 파일만 올릴 수 있어요.").max(100),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "사진은 10MB 이하만 올릴 수 있어요."),
  }).safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  try {
    return c.json(await createSupabaseUploadUrl(c.env, { childId, contentType: parsed.data.contentType }));
  } catch {
    return jsonError(c, 500, "사진 업로드 주소 생성에 실패했어요.");
  }
});

app.get("/api/storage/objects/*", async (c) => {
  const wildcardPath = c.req.param("*");
  const objectPath = `/objects/${wildcardPath}`;
  const db = getDatabase(c.env);
  const [row] = await db
    .select({ childId: missionLogsTable.childId, parentId: missionsTable.parentId })
    .from(missionLogsTable)
    .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
    .where(eq(missionLogsTable.photoUrl, objectPath))
    .limit(1);
  if (!row) return jsonError(c, 404, "사진을 찾을 수 없어요.");
  const session = c.get("session");
  if (session.childId !== row.childId && session.parentId !== row.parentId && session.isAdmin !== true) {
    return jsonError(c, 403, "권한이 없어요.");
  }
  try {
    const response = await fetchSupabaseObject(c.env, objectPath);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^image\//i.test(contentType)) return jsonError(c, 415, "이미지 파일이 아니에요.");
    const headers = new Headers(response.headers);
    headers.set("Content-Type", contentType);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", "inline");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return jsonError(c, 500, "사진을 불러오지 못했어요.");
  }
});

const MIN_TOPUP = 1000;
const MAX_TOPUP = 1_000_000;

function createTopupOrderId(parentId: number): string {
  return `topup_${parentId}_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

const PrepareTopupBody = z.object({
  amount: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
});

const ConfirmTopupBody = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  amount: z.coerce.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
});

app.post("/api/topups/prepare", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const parsed = PrepareTopupBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, `${MIN_TOPUP.toLocaleString("ko-KR")}원 이상 입력해주세요.`);
  const db = getDatabase(c.env);
  try {
    const orderId = createTopupOrderId(parentId);
    const baseUrl = getPublicBaseUrl(c.env, c.req.url, c.req.header("origin"));
    await createPendingBudgetTopup(db, { parentId, orderId, amount: parsed.data.amount });
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, parentId)).limit(1);
    return c.json({
      provider: "toss",
      clientKey: getTossClientKey(c.env),
      customerKey: `parent_${parentId}_${crypto.randomUUID()}`,
      orderId,
      orderName: "5025 예산 충전",
      amount: parsed.data.amount,
      successUrl: `${baseUrl}/?topup=success`,
      failUrl: `${baseUrl}/?topup=fail`,
      customerName: parent?.name,
      customerEmail: parent?.email,
    });
  } catch {
    return jsonError(c, 502, "결제 페이지를 만들지 못했어요.");
  }
});

app.post("/api/topups/confirm", async (c) => {
  const parentId = requireParent(c);
  if (!parentId) return jsonError(c, 401, "부모 로그인이 필요해요.");
  const parsed = ConfirmTopupBody.safeParse(await readJson(c));
  if (!parsed.success) return jsonError(c, 400, "잘못된 요청이에요.");
  const db = getDatabase(c.env);
  try {
    const { paymentKey, orderId, amount } = parsed.data;
    const topup = await getTopupByOrder(db, { parentId, orderId });
    if (!topup) {
      return jsonError(c, 403, "권한이 없어요.");
    }
    if (topup.amount !== amount) {
      return jsonError(c, 400, "결제 금액이 일치하지 않아요.");
    }
    if (topup.status === "paid") {
      const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, parentId)).limit(1);
      return c.json({
        credited: false,
        status: "DONE",
        paidAmount: amount,
        creditedPoints: amount * POINTS_PER_KRW,
        balance: parent?.balance ?? 0,
      });
    }

    const payment = await confirmTossPayment(c.env, { paymentKey, orderId, amount });
    if (payment.orderId !== orderId || payment.paymentKey !== paymentKey || payment.totalAmount !== amount) {
      return jsonError(c, 502, "결제 승인 정보가 일치하지 않아요.");
    }
    if (payment.status !== "DONE") {
      const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, parentId)).limit(1);
      return c.json({ credited: false, status: payment.status, balance: parent?.balance ?? 0 });
    }

    const credited = await completePendingBudgetTopup(db, { parentId, orderId, amount });
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, parentId)).limit(1);
    return c.json({ credited, paidAmount: amount, creditedPoints: amount * POINTS_PER_KRW, balance: parent?.balance ?? 0 });
  } catch (err) {
    if (err instanceof PaymentProviderError) {
      return jsonError(
        c,
        err.status >= 400 && err.status < 500 ? err.status : 502,
        err.message,
        err.code ? { code: err.code } : undefined,
      );
    }
    return jsonError(c, 502, "결제 확인에 실패했어요.");
  }
});

app.post("/api/stripe/webhook", async (c) => {
  const rawBody = await c.req.text();
  const ok = await verifyStripeWebhook(c.env, rawBody, c.req.header("stripe-signature") ?? null);
  if (!ok) return jsonError(c, 400, "Webhook signature verification failed.");

  const event = JSON.parse(rawBody) as {
    type?: string;
    data?: { object?: { id?: string; amount_total?: number; payment_status?: string; metadata?: Record<string, string> } };
  };
  const checkout = event.data?.object;
  if (event.type === "checkout.session.completed" && checkout?.id && checkout.metadata?.kind === TOPUP_KIND) {
    const parentId = Number(checkout.metadata.parentId);
    if (Number.isInteger(parentId) && checkout.payment_status === "paid") {
      await creditBudgetTopup(getDatabase(c.env), {
        parentId,
        sessionId: checkout.id,
        amount: checkout.amount_total ?? 0,
      });
    }
  }
  return c.json({ received: true });
});

app.notFound((c) => jsonError(c, 404, "Not found"));

export default app;
