import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, parentsTable, childrenTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rateLimit } from "../lib/security";

const router = Router();
const passwordAuthLimit = rateLimit({ prefix: "password-auth", windowMs: 15 * 60_000, max: 10 });
const childPinLimit = rateLimit({ prefix: "child-pin", windowMs: 15 * 60_000, max: 6 });

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}

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

// POST /api/auth/signup
router.post("/auth/signup", passwordAuthLimit, async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "입력값을 확인해주세요.", details: parsed.error.issues });
    return;
  }
  const { name, email, password } = parsed.data;

  const existing = await db.select().from(parentsTable).where(eq(parentsTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "이미 사용 중인 이메일이에요." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [parent] = await db
    .insert(parentsTable)
    .values({
      name,
      email,
      passwordHash,
      balance: process.env["NODE_ENV"] === "production" ? 0 : Number(process.env["DEV_SIGNUP_BALANCE"] ?? 50000),
    })
    .returning();

  await regenerateSession(req);
  req.session.parentId = parent.id;
  res.json({ id: parent.id, name: parent.name, email: parent.email, balance: parent.balance });
});

// POST /api/auth/login
router.post("/auth/login", passwordAuthLimit, async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
    return;
  }
  const { email, password } = parsed.data;

  const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.email, email)).limit(1);
  if (!parent) {
    res.status(401).json({ error: "이메일 또는 비밀번호가 맞지 않아요." });
    return;
  }

  const valid = await bcrypt.compare(password, parent.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "이메일 또는 비밀번호가 맞지 않아요." });
    return;
  }

  await regenerateSession(req);
  req.session.parentId = parent.id;
  req.session.childId = undefined;
  res.json({ id: parent.id, name: parent.name, email: parent.email, balance: parent.balance });
});

// POST /api/auth/child-login
router.post("/auth/child-login", childPinLimit, async (req, res) => {
  const parsed = ChildPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "아이 ID와 PIN 4자리를 입력해주세요." });
    return;
  }
  const { childId, pin } = parsed.data;

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) {
    res.status(404).json({ error: "아이 계정을 찾을 수 없어요." });
    return;
  }

  const valid = await bcrypt.compare(pin, child.pinHash);
  if (!valid) {
    res.status(401).json({ error: "PIN이 맞지 않아요. 다시 시도해보세요!" });
    return;
  }

  await regenerateSession(req);
  req.session.childId = child.id;
  req.session.parentId = undefined;
  res.json({ id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  if (req.session.parentId) {
    const [parent] = await db.select().from(parentsTable).where(eq(parentsTable.id, req.session.parentId)).limit(1);
    if (parent) {
      res.json({ role: "parent", id: parent.id, name: parent.name, email: parent.email, balance: parent.balance });
      return;
    }
  }
  if (req.session.childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, req.session.childId)).limit(1);
    if (child) {
      res.json({ role: "child", id: child.id, name: child.name, age: child.age, avatar: child.avatar, balance: child.balance, parentId: child.parentId });
      return;
    }
  }
  res.status(401).json({ error: "로그인이 필요해요." });
});

export default router;
