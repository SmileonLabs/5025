import { Router } from "express";
import { z } from "zod";
import { db, requestsTable, childrenTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const CreateRequestBody = z.object({
  type: z.enum(["allowance", "mission", "message"]),
  message: z.string().min(1).max(500),
});

// POST /api/requests — child sends a request to their parent
router.post("/requests", async (req, res) => {
  if (!req.session?.childId) {
    res.status(401).json({ error: "아이 로그인이 필요해요." });
    return;
  }
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "요청 내용을 확인해주세요." });
    return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.session.childId)).limit(1);
  if (!child) {
    res.status(404).json({ error: "아이를 찾을 수 없어요." });
    return;
  }

  const [request] = await db
    .insert(requestsTable)
    .values({ childId: child.id, parentId: child.parentId, type: parsed.data.type, message: parsed.data.message })
    .returning();

  res.status(201).json(request);
});

// GET /api/requests — parent lists pending requests from their children
router.get("/requests", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모님 로그인이 필요해요." });
    return;
  }
  const rows = await db
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
    .where(and(eq(requestsTable.parentId, req.session.parentId), eq(requestsTable.status, "pending")))
    .orderBy(desc(requestsTable.createdAt));
  res.json(rows);
});

// PATCH /api/requests/:id — parent resolves or dismisses a request
const UpdateRequestBody = z.object({ status: z.enum(["resolved", "dismissed"]) });
router.patch("/requests/:id", async (req, res) => {
  if (!req.session?.parentId) {
    res.status(401).json({ error: "부모님 로그인이 필요해요." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "잘못된 요청이에요." });
    return;
  }
  const parsed = UpdateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "상태값을 확인해주세요." });
    return;
  }

  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, id)).limit(1);
  if (!request || request.parentId !== req.session.parentId) {
    res.status(404).json({ error: "요청을 찾을 수 없어요." });
    return;
  }

  const [updated] = await db
    .update(requestsTable)
    .set({ status: parsed.data.status })
    .where(eq(requestsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
