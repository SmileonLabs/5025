import { createClient } from "@supabase/supabase-js";

const DEFAULT_TOSS_CLIENT_KEY = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";
const DEFAULT_TOSS_SECRET_KEY = "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";

export class PaymentProviderError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function getPublicBaseUrl(env: Env, requestUrl: string, requestOrigin?: string | null): string {
  if (env.WEB_APP_URL) return env.WEB_APP_URL.replace(/\/$/, "");
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  if (env.API_BASE_URL) return env.API_BASE_URL.replace(/\/api$/, "").replace(/\/$/, "");
  return new URL(requestUrl).origin;
}

export function getTossClientKey(env: Env): string {
  return env.TOSS_CLIENT_KEY ?? DEFAULT_TOSS_CLIENT_KEY;
}

export async function confirmTossPayment(
  env: Env,
  params: { paymentKey: string; orderId: string; amount: number },
) {
  const secretKey = env.TOSS_SECRET_KEY ?? DEFAULT_TOSS_SECRET_KEY;
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.orderId,
    },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    totalAmount?: number;
    code?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new PaymentProviderError(res.status, data.message ?? "Toss Payments confirmation failed.", data.code);
  }

  return data;
}

export async function createStripeCheckoutSession(
  env: Env,
  params: { amount: number; parentId: number; successBaseUrl: string },
): Promise<{ id: string; url: string | null }> {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured.");

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("line_items[0][price_data][currency]", "krw");
  body.set("line_items[0][price_data][unit_amount]", String(params.amount));
  body.set("line_items[0][price_data][product_data][name]", "예산 충전 (성경 용돈)");
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[parentId]", String(params.parentId));
  body.set("metadata[kind]", "budget_topup");
  body.set("success_url", `${params.successBaseUrl}/?topup=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${params.successBaseUrl}/?topup=cancel`);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? "Stripe Checkout creation failed.");
  return { id: data.id, url: data.url ?? null };
}

export async function retrieveStripeCheckoutSession(env: Env, sessionId: string) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = (await res.json()) as {
    id: string;
    payment_status?: string;
    amount_total?: number;
    metadata?: Record<string, string>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message ?? "Stripe session retrieval failed.");
  return data;
}

export async function verifyStripeWebhook(env: Env, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!env.STRIPE_WEBHOOK_SECRET || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [k, v] = part.split("=", 2);
      return [k, v];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacHex(signedPayload, env.STRIPE_WEBHOOK_SECRET);
  return timingSafeEqualHex(signature, expected);
}

export async function generateQuiz(env: Env, prompt: string): Promise<string> {
  const apiKey = env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  if (!apiKey) throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY is not configured.");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? "OpenAI request failed.");
  return data.choices?.[0]?.message?.content ?? "";
}

export function getSupabase(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function createSupabaseUploadUrl(
  env: Env,
  params: { childId: number; contentType: string },
): Promise<{ uploadURL: string; objectPath: string }> {
  const bucket = env.SUPABASE_STORAGE_BUCKET ?? "mission-photos";
  const supabase = getSupabase(env);
  const ext = extensionForContentType(params.contentType);
  const path = `${params.childId}/${crypto.randomUUID()}${ext}`;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Failed to create signed upload URL.");
  return { uploadURL: data.signedUrl, objectPath: `/objects/${path}` };
}

export async function fetchSupabaseObject(env: Env, objectPath: string): Promise<Response> {
  const bucket = env.SUPABASE_STORAGE_BUCKET ?? "mission-photos";
  const supabase = getSupabase(env);
  const path = objectPath.replace(/^\/objects\//, "");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Failed to create signed download URL.");
  return fetch(data.signedUrl);
}

export function getVapidPublicKey(env: Env): string | null {
  return env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : null;
}

export function sendPushToParent(_env: Env, _parentId: number, _payload: { title: string; body: string; url?: string }) {
  // Worker migration keeps push subscription storage compatible. Actual Web Push
  // delivery can be wired later with VAPID signing or a managed push provider.
}

function extensionForContentType(contentType: string): string {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/gif/i.test(contentType)) return ".gif";
  return ".jpg";
}

async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
