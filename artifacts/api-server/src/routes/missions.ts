import { Router } from "express";
import { z } from "zod";
import { db, missionsTable, missionLogsTable, missionAssignmentsTable, childrenTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, inArray, sql, or, exists } from "drizzle-orm";
import { sendPushToParent } from "../lib/push";
import { grantBibleReward, approveActivityLog } from "../lib/missionReward";

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

const MissionFields = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  // "bible" = 성경읽기(즉시 지급), "activity" = 부모 확인형 활동 미션
  type: z.enum(["bible", "activity"]),
  reward: z.number().int().min(0).max(100000),
  // activity 전용 (bible은 무시)
  scheduleType: z.enum(["daily", "once"]).default("daily"),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "지정일 형식이 올바르지 않아요.")
    .nullable()
    .optional(),
  timeLimit: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식이 올바르지 않아요.")
    .nullable()
    .optional(),
  requiresPhoto: z.boolean().default(false),
  // activity 전용: 아이별 최대 수행 횟수(승인+대기 누적, 반려 제외). null/미지정이면 무제한.
  maxCompletions: z.number().int().min(1).max(999).nullable().optional(),
  // 대상 아이: assignToAll=true면 부모의 모든 아이(동적). false면 childIds에 명시된 아이만.
  assignToAll: z.boolean().default(true),
  childIds: z.array(z.number().int().positive()).optional(),
  isActive: z.boolean().default(true),
});

// scheduleType === "once" 이면 지정일(scheduledDate)이 반드시 있어야 한다.
// assignToAll=false 이면 childIds가 1명 이상 있어야 한다.
const CreateMissionBody = MissionFields.refine(
  (v) => v.scheduleType !== "once" || !!v.scheduledDate,
  { message: "지정일을 선택해주세요.", path: ["scheduledDate"] },
).refine(
  (v) => v.assignToAll || (v.childIds != null && v.childIds.length > 0),
  { message: "대상 아이를 선택해주세요.", path: ["childIds"] },
);
const UpdateMissionBody = MissionFields.partial().refine(
  (v) => v.scheduleType !== "once" || v.scheduledDate != null,
  { message: "지정일을 선택해주세요.", path: ["scheduledDate"] },
).refine(
  (v) => v.assignToAll !== false || (v.childIds != null && v.childIds.length > 0),
  { message: "대상 아이를 선택해주세요.", path: ["childIds"] },
).refine(
  // childIds만 보내면 라우트가 조용히 무시하므로(assignToAll 미명시 시 재설정 안 함) 명시를 강제
  (v) => v.childIds === undefined || v.assignToAll !== undefined,
  { message: "대상을 바꾸려면 assignToAll을 함께 보내주세요.", path: ["assignToAll"] },
);

// GET /api/missions
router.get("/missions", async (req, res) => {
  if (req.session?.parentId) {
    const missions = await db
      .select()
      .from(missionsTable)
      .where(eq(missionsTable.parentId, req.session.parentId))
      .orderBy(desc(missionsTable.createdAt));
    // assignToAll=false 미션의 대상 아이 목록을 한 번에 조회해 그룹핑
    const scopedIds = missions.filter((m) => !m.assignToAll).map((m) => m.id);
    const assignMap = new Map<number, number[]>();
    if (scopedIds.length > 0) {
      const rows = await db
        .select({ missionId: missionAssignmentsTable.missionId, childId: missionAssignmentsTable.childId })
        .from(missionAssignmentsTable)
        .where(inArray(missionAssignmentsTable.missionId, scopedIds));
      for (const r of rows) {
        const arr = assignMap.get(r.missionId) ?? [];
        arr.push(r.childId);
        assignMap.set(r.missionId, arr);
      }
    }
    res.json(missions.map((m) => ({ ...m, assignedChildIds: m.assignToAll ? [] : assignMap.get(m.id) ?? [] })));
    return;
  }
  if (req.session?.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.session.childId)).limit(1);
    if (!child) { res.status(404).json({ error: "아이를 찾을 수 없어요." }); return; }
    // 전체 대상 미션 OR 이 아이에게 배정된 미션만 노출
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
                .where(
                  and(
                    eq(missionAssignmentsTable.missionId, missionsTable.id),
                    eq(missionAssignmentsTable.childId, child.id),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(desc(missionsTable.createdAt));
    res.json(missions);
    return;
  }
  res.status(401).json({ error: "로그인이 필요해요." });
});

// childIds가 모두 이 부모의 아이인지 검증. 통과하면 중복 제거된 id 배열, 아니면 null.
async function resolveOwnedChildIds(parentId: number, childIds: number[]): Promise<number[] | null> {
  const uniqueIds = [...new Set(childIds)];
  if (uniqueIds.length === 0) return null;
  const owned = await db
    .select({ id: childrenTable.id })
    .from(childrenTable)
    .where(and(eq(childrenTable.parentId, parentId), inArray(childrenTable.id, uniqueIds)));
  return owned.length === uniqueIds.length ? uniqueIds : null;
}

// POST /api/missions
router.post("/missions", requireParent, async (req, res) => {
  const parsed = CreateMissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." }); return; }
  const parentId = req.session.parentId!;
  const { childIds, assignToAll, ...missionData } = parsed.data;
  // maxCompletions(수행 횟수 제한)는 매일(daily) 활동(activity) 미션에만 의미 있음 — 그 외엔 null로 정규화.
  if (missionData.type !== "activity" || missionData.scheduleType !== "daily") {
    missionData.maxCompletions = null;
  }

  // 특정 아이 지정 시 소유 검증 (cross-parent IDOR 방지)
  let validChildIds: number[] = [];
  if (!assignToAll) {
    const resolved = await resolveOwnedChildIds(parentId, childIds ?? []);
    if (!resolved) { res.status(400).json({ error: "대상 아이가 올바르지 않아요." }); return; }
    validChildIds = resolved;
  }

  const mission = await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(missionsTable)
      .values({ parentId, assignToAll, ...missionData })
      .returning();
    if (!assignToAll && validChildIds.length > 0) {
      await tx.insert(missionAssignmentsTable).values(validChildIds.map((childId) => ({ missionId: m.id, childId })));
    }
    return m;
  });
  res.status(201).json({ ...mission, assignedChildIds: assignToAll ? [] : validChildIds });
});

// PATCH /api/missions/:id
router.patch("/missions/:id", requireParent, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parentId = req.session.parentId!;
  const [existing] = await db.select().from(missionsTable)
    .where(and(eq(missionsTable.id, id), eq(missionsTable.parentId, parentId))).limit(1);
  if (!existing) { res.status(404).json({ error: "미션을 찾을 수 없어요." }); return; }
  const parsed = UpdateMissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." }); return; }
  const { childIds, assignToAll, ...missionData } = parsed.data;
  // maxCompletions는 매일 활동미션에만 유효 — 패치 결과가 그 외 형태면 null로 정규화(스테일 방지).
  const effType = missionData.type ?? existing.type;
  const effSchedule = missionData.scheduleType ?? existing.scheduleType;
  if (effType !== "activity" || effSchedule !== "daily") {
    missionData.maxCompletions = null;
  }

  // 대상을 특정 아이로 바꾸는 경우 소유 검증
  let validChildIds: number[] = [];
  if (assignToAll === false) {
    const resolved = await resolveOwnedChildIds(parentId, childIds ?? []);
    if (!resolved) { res.status(400).json({ error: "대상 아이가 올바르지 않아요." }); return; }
    validChildIds = resolved;
  }

  const updated = await db.transaction(async (tx) => {
    const setData: Record<string, unknown> = { ...missionData };
    if (assignToAll !== undefined) setData.assignToAll = assignToAll;
    let row = existing;
    if (Object.keys(setData).length > 0) {
      [row] = await tx.update(missionsTable).set(setData).where(eq(missionsTable.id, id)).returning();
    }
    // assignToAll이 명시된 경우에만 assignments 재설정 (불변식: assignToAll=true ⟹ assignments 없음)
    if (assignToAll === true) {
      await tx.delete(missionAssignmentsTable).where(eq(missionAssignmentsTable.missionId, id));
    } else if (assignToAll === false) {
      await tx.delete(missionAssignmentsTable).where(eq(missionAssignmentsTable.missionId, id));
      if (validChildIds.length > 0) {
        await tx.insert(missionAssignmentsTable).values(validChildIds.map((childId) => ({ missionId: id, childId })));
      }
    }
    return row;
  });

  const assignedChildIds = updated.assignToAll
    ? []
    : (
        await db
          .select({ childId: missionAssignmentsTable.childId })
          .from(missionAssignmentsTable)
          .where(eq(missionAssignmentsTable.missionId, id))
      ).map((a) => a.childId);
  res.json({ ...updated, assignedChildIds });
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

  // 대상 검증: 전체 대상이 아니면 이 아이에게 배정된 미션만 제출 가능 (bible/activity 공통)
  if (!mission.assignToAll) {
    const [assigned] = await db
      .select({ id: missionAssignmentsTable.id })
      .from(missionAssignmentsTable)
      .where(and(eq(missionAssignmentsTable.missionId, missionId), eq(missionAssignmentsTable.childId, childId)))
      .limit(1);
    if (!assigned) { res.status(403).json({ error: "이 미션의 대상이 아니에요." }); return; }
  }

  // Activity type → pending parent approval (스케줄·마감·인증샷 검증)
  if (mission.type === "activity") {
    const actBody = z
      .object({ photoUrl: z.string().startsWith("/objects/").max(500).optional() })
      .safeParse(req.body);
    const photoUrl = actBody.success ? actBody.data.photoUrl : undefined;

    // 인증샷 필수 미션인데 사진이 없으면 거부
    if (mission.requiresPhoto && !photoUrl) {
      res.status(400).json({ error: "인증샷을 올려주세요." });
      return;
    }

    // 마감 시각(KST) enforce — 현재 KST HH:MM이 timeLimit을 지났으면 거부
    if (mission.timeLimit) {
      const nowKstHHMM = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
      if (nowKstHHMM > mission.timeLimit) {
        res.status(409).json({ error: `마감 시간(${mission.timeLimit})이 지났어요.` });
        return;
      }
    }

    // 지정일(once) enforce — 오늘(KST)이 지정일이 아니면 제출 거부
    if (mission.scheduleType === "once" && mission.scheduledDate) {
      const todayKst = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (mission.scheduledDate !== todayKst) {
        res.status(409).json({ error: `이 미션은 ${mission.scheduledDate}에 할 수 있어요.` });
        return;
      }
    }

    // 동시 제출(더블탭/병렬)이 중복 검사와 횟수 검사를 동시에 통과하면 requested 로그가
    // 초과 생성되고 부모가 양쪽을 승인해 포인트가 초과 지급될 수 있다. (missionId, childId)
    // advisory lock으로 같은 아이의 같은 미션 제출을 직렬화하고, 중복·횟수 검사와 insert를
    // 한 트랜잭션에서 원자적으로 처리한다.
    type SubmitResult =
      | { ok: true; log: typeof missionLogsTable.$inferSelect }
      | { ok: false; error: string };
    const result = await db.transaction(async (tx): Promise<SubmitResult> => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${missionId}::int, ${childId}::int)`);

      // 중복 방지: 미처리(requested/approved) 요청이 있으면 차단.
      // daily는 오늘(KST) 분만, once는 기간 무관. rejected는 제외(재도전 가능).
      const dupConds = [
        eq(missionLogsTable.missionId, missionId),
        eq(missionLogsTable.childId, childId),
        inArray(missionLogsTable.status, ["requested", "approved"]),
      ];
      if (mission.scheduleType === "daily") {
        dupConds.push(
          sql`(${missionLogsTable.createdAt} AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date`,
        );
      }
      const dup = await tx
        .select({ id: missionLogsTable.id })
        .from(missionLogsTable)
        .where(and(...dupConds))
        .limit(1);
      if (dup.length > 0) {
        return {
          ok: false,
          error:
            mission.scheduleType === "daily"
              ? "오늘은 이미 완료 요청했어요."
              : "이미 완료 요청한 미션이에요.",
        };
      }

      // 수행 횟수 제한: 이 아이의 누적 수행(승인+대기) 횟수가 상한에 도달하면 차단.
      // rejected는 세지 않음(재도전 가능). maxCompletions가 null이면 무제한.
      if (mission.maxCompletions != null) {
        const [{ cnt }] = await tx
          .select({ cnt: sql<number>`count(*)::int` })
          .from(missionLogsTable)
          .where(
            and(
              eq(missionLogsTable.missionId, missionId),
              eq(missionLogsTable.childId, childId),
              inArray(missionLogsTable.status, ["requested", "approved"]),
            ),
          );
        if (cnt >= mission.maxCompletions) {
          return { ok: false, error: `이 미션은 ${mission.maxCompletions}번까지만 할 수 있어요. 이미 다 했어요! 🎉` };
        }
      }

      const [inserted] = await tx
        .insert(missionLogsTable)
        .values({ missionId, childId, status: "requested", photoUrl: photoUrl ?? null })
        .returning();
      return { ok: true, log: inserted };
    });

    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }

    void sendPushToParent(child.parentId, {
      title: "📋 미션 승인 요청",
      body: `${child.name}님이 '${mission.title}' 미션을 완료했어요. 승인하면 ${mission.reward.toLocaleString("ko-KR")}P가 지급돼요.`,
    });
    res.status(201).json({ log: result.log, pending: true });
    return;
  }

  // Bible → immediate reward (책/장 + 묵상 검증 후 즉시 지급)
  const bodyParsed = z.object({
    bibleBook: z.string().optional(),
    bibleChapter: z.number().int().optional(),
    reflection: z.string().optional(),
  }).safeParse(req.body);
  const { bibleBook, bibleChapter, reflection } = bodyParsed.success ? bodyParsed.data : {};

  // 퀴즈 스냅샷은 "표시용" best-effort 데이터다. 보상 지급 게이트(책/장/묵상)와 분리해
  // 독립 파싱하고, 검증 실패 시 미션 완료를 막지 않고 quiz만 버린다(잘못된 400 방지).
  // 크기 캡으로 남용을 막고, correctIndex가 옵션 범위를 벗어나면 해당 스냅샷을 버린다.
  const quizParsed = z.array(z.object({
    question: z.string().min(1).max(500),
    options: z.array(z.string().max(200)).min(2).max(6),
    correctIndex: z.number().int().min(0),
  }).refine(q => q.correctIndex < q.options.length))
    .max(5)
    .safeParse((req.body as { quiz?: unknown } | undefined)?.quiz);
  const quiz = quizParsed.success ? quizParsed.data : undefined;

  if (mission.type === "bible") {
    // Bible missions require chapter context (proof of which chapter was read)
    if (!bibleBook || !bibleChapter) {
      res.status(400).json({ error: "성경 책과 장 정보가 필요해요." });
      return;
    }
    // ...and a reflection note before reward is granted
    if (!reflection || reflection.trim().length < 5) {
      res.status(400).json({ error: "묵상 내용을 5자 이상 적어주세요." });
      return;
    }
    // Prevent duplicate bible chapter completion
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

  // 닫힌 용돈 구조: 보상은 부모 잔액에서 차감되어 아이에게 적립된다(원자적 트랜잭션).
  const result = await grantBibleReward({
    parentId: child.parentId,
    childId,
    missionId,
    reward: mission.reward,
    bibleBook: bibleBook!,
    bibleChapter: bibleChapter!,
    reflection: reflection!,
    quiz,
    description: `${bibleBook} ${bibleChapter}장 읽기 완료`,
  });

  if (!result.ok) {
    if (result.reason === "duplicate") {
      res.status(409).json({ error: "이미 완료한 장이에요!" });
      return;
    }
    // 부모 잔액 부족 → 보상 차단 + 충전 안내(닫힌 구조). 부모에게도 알린다.
    void sendPushToParent(child.parentId, {
      title: "⚠️ 미션 보상 지급 실패",
      body: `${child.name}님이 '${mission.title}' 미션을 완료했지만 포인트가 부족해 보상을 못 줬어요. 충전하면 다시 받을 수 있어요.`,
    });
    res.status(402).json({ error: "부모님 포인트가 부족해 지금은 보상을 받을 수 없어요. 부모님께 충전을 부탁해요." });
    return;
  }

  void sendPushToParent(child.parentId, {
    title: "🎉 미션 완료!",
    body: `${child.name}님이 '${mission.title}' 미션을 완료하고 ${mission.reward.toLocaleString("ko-KR")}P를 받았어요.`,
  });

  res.status(201).json({ log: result.log, tx: result.tx, childBalance: result.childBalance });
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

// GET /api/mission-logs  (수행 내역: 아이→본인, 부모→자녀 전체. 세션 스코프, childId/parentId 클라 입력 없음)
router.get("/mission-logs", async (req, res) => {
  if (req.session?.parentId) {
    const parentMissions = await db.select({ id: missionsTable.id })
      .from(missionsTable).where(eq(missionsTable.parentId, req.session.parentId));
    if (parentMissions.length === 0) { res.json([]); return; }
    const missionIds = parentMissions.map((m) => m.id);
    const rows = await db
      .select({ log: missionLogsTable, mission: missionsTable, child: childrenTable, txAmount: transactionsTable.amount })
      .from(missionLogsTable)
      .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
      .innerJoin(childrenTable, eq(missionLogsTable.childId, childrenTable.id))
      .leftJoin(transactionsTable, eq(missionLogsTable.transactionId, transactionsTable.id))
      .where(inArray(missionLogsTable.missionId, missionIds))
      .orderBy(desc(missionLogsTable.createdAt));
    res.json(rows.map((r) => ({
      ...r.log,
      // 지급 완료(transaction 존재)면 실제 지급액, 아니면 미션 예정 보상
      rewardAmount: r.log.transactionId != null && r.txAmount != null ? r.txAmount : r.mission.reward,
      mission: { id: r.mission.id, title: r.mission.title, type: r.mission.type, reward: r.mission.reward, scheduleType: r.mission.scheduleType },
      child: { id: r.child.id, name: r.child.name, avatar: r.child.avatar },
    })));
    return;
  }
  if (req.session?.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.session.childId)).limit(1);
    if (!child) { res.status(404).json({ error: "아이를 찾을 수 없어요." }); return; }
    const rows = await db
      .select({ log: missionLogsTable, mission: missionsTable, txAmount: transactionsTable.amount })
      .from(missionLogsTable)
      .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
      .leftJoin(transactionsTable, eq(missionLogsTable.transactionId, transactionsTable.id))
      .where(eq(missionLogsTable.childId, child.id))
      .orderBy(desc(missionLogsTable.createdAt));
    res.json(rows.map((r) => ({
      ...r.log,
      rewardAmount: r.log.transactionId != null && r.txAmount != null ? r.txAmount : r.mission.reward,
      mission: { id: r.mission.id, title: r.mission.title, type: r.mission.type, reward: r.mission.reward, scheduleType: r.mission.scheduleType },
    })));
    return;
  }
  res.status(401).json({ error: "로그인이 필요해요." });
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

  // 닫힌 용돈 구조: 승인 시 부모 잔액에서 차감되어 아이에게 적립된다(이중승인·잔액부족 안전).
  const result = await approveActivityLog({
    logId,
    parentId: mission.parentId,
    childId: log.childId,
    reward: mission.reward,
    description: `${mission.title} 완료 (부모 확인)`,
  });

  if (!result.ok) {
    if (result.reason === "already_processed") {
      res.status(409).json({ error: "이미 처리된 미션이에요." });
      return;
    }
    res.status(402).json({ error: "포인트가 부족해요. 충전 후 다시 승인해주세요." });
    return;
  }

  res.json({ log: result.log, childBalance: result.childBalance, parentBalance: result.parentBalance });
});

// POST /api/mission-logs/:logId/reject  (parent)
router.post("/mission-logs/:logId/reject", requireParent, async (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  const [log] = await db.select().from(missionLogsTable).where(eq(missionLogsTable.id, logId)).limit(1);
  if (!log || log.status !== "requested") { res.status(404).json({ error: "대기 중인 미션을 찾을 수 없어요." }); return; }

  const [mission] = await db.select().from(missionsTable)
    .where(and(eq(missionsTable.id, log.missionId), eq(missionsTable.parentId, req.session.parentId!))).limit(1);
  if (!mission) { res.status(403).json({ error: "권한이 없어요." }); return; }

  // 조건부 UPDATE(WHERE status='requested')로 동시 approve/reject 경합을 차단한다.
  // 무조건 덮어쓰면 먼저 커밋된 approve(부모 차감·아이 적립·approved)를 reject가 가려서
  // 아이가 포인트를 가진 채 로그만 rejected가 되고, rejected는 재도전 허용이라 이중 보상이 가능하다.
  const [updatedLog] = await db
    .update(missionLogsTable).set({ status: "rejected" })
    .where(and(eq(missionLogsTable.id, logId), eq(missionLogsTable.status, "requested"))).returning();
  if (!updatedLog) { res.status(409).json({ error: "이미 처리된 미션이에요." }); return; }
  res.json({ log: updatedLog });
});

export default router;
