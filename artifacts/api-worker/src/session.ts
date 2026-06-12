import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { AppContext, SessionData } from "./http";

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SignedSession {
  data: SessionData;
  exp: number;
}

export async function sessionMiddleware(c: Context<AppContext>, next: Next) {
  const raw = getCookie(c, COOKIE_NAME);
  const session = raw ? await verifySession(raw, c.env.SESSION_SECRET) : {};
  c.set("session", session ?? {});
  await next();
}

export async function setSession(c: Context<AppContext>, data: SessionData) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const value = await signSession({ data, exp }, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, value, cookieOptions(c));
  c.set("session", data);
}

export function clearSession(c: Context<AppContext>) {
  deleteCookie(c, COOKIE_NAME, cookieOptions(c));
  c.set("session", {});
}

export function requireParent(c: Context<AppContext>): number | null {
  return c.get("session").parentId ?? null;
}

export function requireChild(c: Context<AppContext>): number | null {
  return c.get("session").childId ?? null;
}

export function requireAdminSession(c: Context<AppContext>): boolean {
  return c.get("session").isAdmin === true;
}

function cookieOptions(c: Context<AppContext>) {
  const sameSite = c.env.COOKIE_SAMESITE ?? "Lax";
  const secure = c.env.COOKIE_SECURE === "false" ? false : sameSite === "None" || c.req.url.startsWith("https://");
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  } as const;
}

async function signSession(payload: SignedSession, secret: string): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

async function verifySession(raw: string, secret: string): Promise<SessionData | null> {
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body, secret);
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SignedSession;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.data ?? {};
  } catch {
    return null;
  }
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
