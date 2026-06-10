import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getAdminPassword, requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

// POST /api/admin/login — exchange the operator password for an admin session
router.post("/admin/login", (req, res) => {
  const adminPw = getAdminPassword();
  if (!adminPw) {
    res.status(503).json({ error: "운영자 기능이 아직 설정되지 않았어요." });
    return;
  }

  const parsed = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "비밀번호를 입력해주세요." });
    return;
  }

  if (parsed.data.password !== adminPw) {
    res.status(401).json({ error: "비밀번호가 맞지 않아요." });
    return;
  }

  req.session.isAdmin = true;
  req.session.parentId = undefined;
  req.session.childId = undefined;
  res.json({ ok: true });
});

// POST /api/admin/logout
router.post("/admin/logout", (req, res) => {
  req.session.isAdmin = undefined;
  res.json({ ok: true });
});

// GET /api/admin/me — confirm an active admin session
router.get("/admin/me", requireAdmin, (_req, res) => {
  res.json({ isAdmin: true });
});

export default router;
