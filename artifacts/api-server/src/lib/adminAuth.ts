import type { Request, Response, NextFunction } from "express";

/** The operator password, or undefined when the feature isn't configured yet. */
export function getAdminPassword(): string | undefined {
  const pw = process.env["ADMIN_PASSWORD"];
  return pw && pw.length > 0 ? pw : undefined;
}

/**
 * Gate operator-only routes. Refuses entirely (503) when ADMIN_PASSWORD is unset
 * so the admin surface can't be reached before it's intentionally configured.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!getAdminPassword()) {
    res.status(503).json({ error: "운영자 기능이 아직 설정되지 않았어요." });
    return;
  }
  if (!req.session.isAdmin) {
    res.status(401).json({ error: "운영자 로그인이 필요해요." });
    return;
  }
  next();
}
