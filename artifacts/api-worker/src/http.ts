import type { Context, Next } from "hono";

export type AppContext = {
  Bindings: Env;
  Variables: {
    session: SessionData;
  };
};

export interface SessionData {
  parentId?: number;
  childId?: number;
  isAdmin?: boolean;
}

export function jsonError(c: Context, status: number, error: string, extra?: Record<string, unknown>) {
  return c.json({ error, ...extra }, status as never);
}

export function parseId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

export async function corsMiddleware(c: Context<AppContext>, next: Next): Promise<Response | void> {
  const origin = c.req.header("Origin");
  const allowed = parseAllowedOrigins(c.env.ALLOWED_ORIGINS);
  const allowOrigin =
    origin && (allowed.has("*") || allowed.has(origin) || isLocalDevOrigin(origin))
      ? origin
      : undefined;

  if (allowOrigin) {
    c.header("Access-Control-Allow-Origin", allowOrigin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Stripe-Signature");
  c.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  return next();
}

function parseAllowedOrigins(value?: string): Set<string> {
  if (!value?.trim()) return new Set(["http://localhost:5173", "capacitor://localhost", "ionic://localhost"]);
  return new Set(value.split(",").map((v) => v.trim()).filter(Boolean));
}

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}
