import type { NextFunction, Request, RequestHandler, Response } from "express";

export function getAllowedOrigins(): Set<string> {
  const configured = process.env["ALLOWED_ORIGINS"] ?? process.env["WEB_APP_URL"] ?? "";
  return new Set(
    configured
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (process.env["NODE_ENV"] !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return getAllowedOrigins().has(origin.replace(/\/$/, ""));
}

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();

/** Lightweight per-instance limiter. Replace with a shared Redis-backed store when scaling beyond one region. */
export function rateLimit(options: { windowMs: number; max: number; prefix: string }): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const account = typeof req.body?.email === "string"
      ? req.body.email.toLowerCase()
      : typeof req.body?.childId === "number"
        ? String(req.body.childId)
        : "anonymous";
    const identity = `${req.ip || req.socket.remoteAddress || "unknown"}:${account}`;
    const key = `${options.prefix}:${identity}`;
    const current = attempts.get(key);
    const attempt = !current || current.resetAt <= now
      ? { count: 1, resetAt: now + options.windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };
    attempts.set(key, attempt);

    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.max - attempt.count));
    res.setHeader("RateLimit-Reset", Math.ceil(attempt.resetAt / 1000));

    if (attempt.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((attempt.resetAt - now) / 1000));
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }
    next();
  };
}

export function requireProductionSecurityConfig(): void {
  if (process.env["NODE_ENV"] !== "production") return;
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  if (getAllowedOrigins().size === 0) {
    throw new Error("ALLOWED_ORIGINS or WEB_APP_URL must be configured in production.");
  }
}
