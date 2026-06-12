interface Env {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  SESSION_SECRET: string;
  ALLOWED_ORIGINS?: string;
  COOKIE_SAMESITE?: "Lax" | "None" | "Strict";
  COOKIE_SECURE?: string;
  API_BASE_URL?: string;
  WEB_APP_URL?: string;
  ADMIN_PASSWORD?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TOSS_CLIENT_KEY?: string;
  TOSS_SECRET_KEY?: string;
  AI_INTEGRATIONS_OPENAI_BASE_URL?: string;
  AI_INTEGRATIONS_OPENAI_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
