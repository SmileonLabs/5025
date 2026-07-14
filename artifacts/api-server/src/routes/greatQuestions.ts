import { Router } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { childrenTable, db, greatQuestionMessagesTable, greatQuestionProfilesTable, greatQuestionSessionsTable, parentsTable, transactionsTable } from "@workspace/db";
import { createDailyScenario, createGreatQuestionReply, evaluateGreatQuestion, greatQuestionPoints } from "../lib/greatQuestionAi";
import { moderateReadingMessage } from "../lib/readingConversation";
import { normalizeQuestionDecision } from "../lib/greatQuestionConversation";

const router = Router();
const DOMAINS = [
  { key: "people", label: "사람들이 더 행복하게 지내는 세상", emoji: "🤝" },
  { key: "earth", label: "지구와 동물을 지키는 세상", emoji: "🌱" },
  { key: "invention", label: "불편한 것을 새롭게 바꾸는 세상", emoji: "💡" },
  { key: "space", label: "우주와 아직 모르는 것을 탐험하는 세상", emoji: "🚀" },
  { key: "fairness", label: "누구나 공평한 기회를 얻는 세상", emoji: "⚖️" },
  { key: "health", label: "아픈 사람을 돕고 건강하게 사는 세상", emoji: "💚" },
] as const;
const todayKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const requireChild = (req: any, res: any, next: any) => req.session?.childId ? next() : res.status(401).json({ error: "아이 로그인이 필요해요." });
const hasQuestion = (content: string) => /[?？]|(왜|어떻게|무엇|뭐|누구|언제|어디|어떤|얼마나|할까|인가|인지|없을까|될까|줄까|줄래)/.test(content.replace(/\s/g, ""));

async function ownedSession(id: number, childId: number) {
  const [row] = await db.select({ session: greatQuestionSessionsTable, child: childrenTable }).from(greatQuestionSessionsTable)
    .innerJoin(childrenTable, eq(greatQuestionSessionsTable.childId, childrenTable.id))
    .where(and(eq(greatQuestionSessionsTable.id, id), eq(greatQuestionSessionsTable.childId, childId))).limit(1);
  return row;
}

router.get("/great-questions", requireChild, async (req, res) => {
  const childId = req.session.childId!;
  const [profile] = await db.select().from(greatQuestionProfilesTable).where(eq(greatQuestionProfilesTable.childId, childId)).limit(1);
  const [session] = await db.select().from(greatQuestionSessionsTable).where(and(eq(greatQuestionSessionsTable.childId, childId), eq(greatQuestionSessionsTable.sessionDate, todayKst()))).limit(1);
  const messages = session ? await db.select().from(greatQuestionMessagesTable).where(eq(greatQuestionMessagesTable.sessionId, session.id)).orderBy(greatQuestionMessagesTable.createdAt) : [];
  res.json({ domains: DOMAINS, profile: profile ?? null, session: session ?? null, messages });
});

router.get("/great-questions/notebook", requireChild, async (req, res) => {
  const sessions = await db.select().from(greatQuestionSessionsTable)
    .where(and(eq(greatQuestionSessionsTable.childId, req.session.childId!), eq(greatQuestionSessionsTable.status, "completed")))
    .orderBy(desc(greatQuestionSessionsTable.completedAt))
    .limit(100);
  if (sessions.length === 0) { res.json([]); return; }

  const childMessages = await db.select().from(greatQuestionMessagesTable)
    .where(and(
      inArray(greatQuestionMessagesTable.sessionId, sessions.map((session) => session.id)),
      eq(greatQuestionMessagesTable.role, "child"),
    ))
    .orderBy(greatQuestionMessagesTable.createdAt);
  const lastQuestionBySession = new Map<number, string>();
  for (const message of childMessages) lastQuestionBySession.set(message.sessionId, message.content);

  res.json(sessions.map((session) => ({
    id: session.id,
    sessionDate: session.sessionDate,
    domainLabel: session.domainLabel,
    scenario: session.scenario,
    questionTitle: session.questionTitle ?? session.evaluation?.questionTitle ?? "오늘의 위대한 질문",
    finalQuestion: session.finalQuestion ?? session.evaluation?.greatQuestion ?? lastQuestionBySession.get(session.id) ?? "오늘의 생각을 멋진 질문으로 만들었어요.",
    rewardPoints: session.rewardPoints,
    reason: session.evaluation?.reason ?? "새로운 생각의 문을 여는 질문이에요.",
    completedAt: session.completedAt,
  })));
});

router.put("/great-questions/profile", requireChild, async (req, res) => {
  const parsed = z.object({ domainKey: z.string() }).safeParse(req.body);
  const domain = parsed.success ? DOMAINS.find((item) => item.key === parsed.data.domainKey) : null;
  if (!domain) { res.status(400).json({ error: "관심 분야를 다시 골라 주세요." }); return; }
  const childId = req.session.childId!;
  const [profile] = await db.insert(greatQuestionProfilesTable).values({ childId, domainKey: domain.key, domainLabel: domain.label })
    .onConflictDoUpdate({ target: greatQuestionProfilesTable.childId, set: { domainKey: domain.key, domainLabel: domain.label, selectedAt: new Date(), updatedAt: new Date() } }).returning();
  res.json(profile);
});

router.post("/great-questions/sessions", requireChild, async (req, res) => {
  const childId = req.session.childId!;
  const [existing] = await db.select().from(greatQuestionSessionsTable).where(and(eq(greatQuestionSessionsTable.childId, childId), eq(greatQuestionSessionsTable.sessionDate, todayKst()))).limit(1);
  if (existing) {
    const messages = await db.select().from(greatQuestionMessagesTable).where(eq(greatQuestionMessagesTable.sessionId, existing.id)).orderBy(greatQuestionMessagesTable.createdAt);
    res.json({ session: existing, messages }); return;
  }
  const [profile] = await db.select().from(greatQuestionProfilesTable).where(eq(greatQuestionProfilesTable.childId, childId)).limit(1);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!profile || !child) { res.status(409).json({ error: "먼저 관심 있는 세상을 골라 주세요." }); return; }
  const recent = await db.select({ scenario: greatQuestionSessionsTable.scenario }).from(greatQuestionSessionsTable).where(eq(greatQuestionSessionsTable.childId, childId)).orderBy(desc(greatQuestionSessionsTable.startedAt)).limit(7);
  const generated = await createDailyScenario({ age: child.age, domainLabel: profile.domainLabel, recentScenarios: recent.map((r) => r.scenario) });
  const [session] = await db.insert(greatQuestionSessionsTable).values({ childId, sessionDate: todayKst(), domainKey: profile.domainKey, domainLabel: profile.domainLabel, scenario: generated.scenario }).returning();
  const [message] = await db.insert(greatQuestionMessagesTable).values({ sessionId: session.id, role: "assistant", content: generated.opening }).returning();
  res.status(201).json({ session, messages: [message] });
});

router.post("/great-questions/sessions/:id/messages", requireChild, async (req, res) => {
  const id = Number(req.params.id); const parsed = z.object({ content: z.string().trim().min(2).max(800) }).safeParse(req.body);
  const row = Number.isInteger(id) ? await ownedSession(id, req.session.childId!) : null;
  if (!parsed.success || !row || row.session.status !== "in_progress") { res.status(400).json({ error: "진행 중인 대화를 확인해 주세요." }); return; }
  if (await moderateReadingMessage(parsed.data.content)) { res.status(400).json({ error: "그 이야기는 보호자와 먼저 나눠 주세요. 오늘 상황에서 궁금한 것을 물어볼까요?" }); return; }
  const history = await db.select().from(greatQuestionMessagesTable).where(eq(greatQuestionMessagesTable.sessionId, id)).orderBy(greatQuestionMessagesTable.createdAt);
  const conversation = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "child" as const, content: parsed.data.content },
  ];
  const aiDecision = await createGreatQuestionReply({ age: row.child.age, domainLabel: row.session.domainLabel, scenario: row.session.scenario, messages: conversation });
  const decision = normalizeQuestionDecision(aiDecision, parsed.data.content);
  await db.transaction(async (tx) => {
    await tx.insert(greatQuestionMessagesTable).values({ sessionId: id, role: "child", content: parsed.data.content });
    await tx.insert(greatQuestionMessagesTable).values({ sessionId: id, role: "assistant", content: decision.reply });
    await tx.update(greatQuestionSessionsTable).set({ childMessageCount: sql`${greatQuestionSessionsTable.childMessageCount} + 1` }).where(eq(greatQuestionSessionsTable.id, id));
  });
  res.json(decision);
});

router.post("/great-questions/sessions/:id/complete", requireChild, async (req, res) => {
  const id = Number(req.params.id); const row = Number.isInteger(id) ? await ownedSession(id, req.session.childId!) : null;
  if (!row || row.session.status !== "in_progress") { res.status(409).json({ error: "이미 마친 대화이거나 찾을 수 없어요." }); return; }
  const history = await db.select().from(greatQuestionMessagesTable).where(eq(greatQuestionMessagesTable.sessionId, id)).orderBy(greatQuestionMessagesTable.createdAt);
  const childQuestions = history.filter((message) => message.role === "child" && hasQuestion(message.content));
  if (childQuestions.length === 0) { res.status(409).json({ error: "포인트는 상황과 연결된 질문을 만들었을 때 받을 수 있어요. 떠오르는 질문을 하나 들려줄래?" }); return; }
  const evaluation = await evaluateGreatQuestion({ age: row.child.age, domainLabel: row.session.domainLabel, scenario: row.session.scenario, messages: history.map((m) => ({ role: m.role, content: m.content })) });
  const points = greatQuestionPoints(evaluation);
  if (points === 0) { res.json({ status: "in_progress", rewardPoints: 0, evaluation, message: "아직 오늘의 위대한 질문이 완성되지 않았어요. AI와 조금 더 이야기해 보세요." }); return; }
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.update(greatQuestionSessionsTable).set({
      status: "completed", rewardPoints: points, evaluation,
      finalQuestion: evaluation.greatQuestion, questionTitle: evaluation.questionTitle,
      completedAt: new Date(),
    }).where(and(eq(greatQuestionSessionsTable.id, id), eq(greatQuestionSessionsTable.status, "in_progress"))).returning();
    if (!locked) return null;
    const [parent] = await tx.update(parentsTable).set({ balance: sql`${parentsTable.balance} - ${points}` }).where(and(eq(parentsTable.id, row.child.parentId), gte(parentsTable.balance, points))).returning();
    if (!parent) throw new Error("PARENT_BALANCE");
    const [child] = await tx.update(childrenTable).set({ balance: sql`${childrenTable.balance} + ${points}` }).where(eq(childrenTable.id, row.child.id)).returning();
    const [transaction] = await tx.insert(transactionsTable).values({ childId: row.child.id, amount: points, description: "위대한 질문 미션 완료", type: "mission", category: "great_question" }).returning();
    await tx.update(greatQuestionSessionsTable).set({ transactionId: transaction.id }).where(eq(greatQuestionSessionsTable.id, id));
    return child;
  }).catch((error) => { if (error.message === "PARENT_BALANCE") return "balance" as const; throw error; });
  if (result === "balance") { res.status(402).json({ error: "부모님 포인트가 부족해서 아직 보상을 받을 수 없어요." }); return; }
  if (!result) { res.status(409).json({ error: "이미 보상을 받았어요." }); return; }
  res.json({ status: "completed", rewardPoints: points, evaluation, childBalance: result.balance });
});

router.post("/great-questions/sessions/:id/reset", requireChild, async (req, res) => {
  const id = Number(req.params.id); const row = Number.isInteger(id) ? await ownedSession(id, req.session.childId!) : null;
  if (!row) { res.status(404).json({ error: "대화를 찾을 수 없어요." }); return; }
  if (row.session.rewardPoints >= 2000) { res.status(409).json({ error: "2,000P를 받은 질문은 이미 가장 높은 보상이라 다시 도전할 수 없어요." }); return; }

  const reset = await db.transaction(async (tx) => {
    if (row.session.transactionId && row.session.rewardPoints > 0) {
      const [child] = await tx.update(childrenTable).set({ balance: sql`${childrenTable.balance} - ${row.session.rewardPoints}` })
        .where(and(eq(childrenTable.id, row.child.id), gte(childrenTable.balance, row.session.rewardPoints))).returning();
      if (!child) return "spent" as const;
      await tx.update(parentsTable).set({ balance: sql`${parentsTable.balance} + ${row.session.rewardPoints}` }).where(eq(parentsTable.id, row.child.parentId));
      await tx.delete(transactionsTable).where(eq(transactionsTable.id, row.session.transactionId));
    }
    await tx.delete(greatQuestionSessionsTable).where(eq(greatQuestionSessionsTable.id, id));
    return "reset" as const;
  });
  if (reset === "spent") { res.status(409).json({ error: "이미 사용한 포인트가 있어 다시 도전할 수 없어요." }); return; }
  res.json({ status: "reset" });
});

export default router;
