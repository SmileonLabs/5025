import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";
import { getAdminPassword, requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

/** Constant-time password comparison that does not leak length via early exit. */
function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison against a same-length buffer to keep timing flat.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

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

  if (!passwordMatches(parsed.data.password, adminPw)) {
    res.status(401).json({ error: "비밀번호가 맞지 않아요." });
    return;
  }

  // Regenerate the session id on privilege elevation to thwart session fixation.
  req.session.regenerate((err) => {
    if (err) {
      req.log.error({ err }, "Admin session regeneration failed.");
      res.status(500).json({ error: "로그인 중 문제가 발생했어요." });
      return;
    }
    req.session.isAdmin = true;
    req.session.parentId = undefined;
    req.session.childId = undefined;
    res.json({ ok: true });
  });
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
