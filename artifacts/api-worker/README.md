# 5025 Cloudflare Worker API

This is the Cloudflare Workers version of the API. It keeps the same `/api/*`
HTTP contract used by the web and Capacitor apps, but replaces Express sessions
with a signed HTTP-only cookie and uses Worker-compatible Postgres access.

## Runtime Shape

- Worker runtime: Hono
- DB: Supabase Postgres through Cloudflare Hyperdrive, or `DATABASE_URL`
- ORM: Drizzle with the existing `@workspace/db/schema`
- File uploads: Supabase Storage signed upload URLs
- Payments: Toss Payments V2 payment window and REST confirmation API

## Local Dev

Copy `.dev.vars.example` to `.dev.vars` and fill the values:

```bash
cp artifacts/api-worker/.dev.vars.example artifacts/api-worker/.dev.vars
```

Then run:

```bash
corepack pnpm --filter @workspace/api-worker run dev
```

For production, prefer Cloudflare Hyperdrive. Create a Hyperdrive connection to
the Supabase Postgres pooler/session connection string, then add the generated
binding to `wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-id"
```

## Required Secrets

Set these with `wrangler secret put`:

```bash
corepack pnpm --filter @workspace/api-worker exec wrangler secret put SESSION_SECRET
corepack pnpm --filter @workspace/api-worker exec wrangler secret put TOSS_SECRET_KEY
corepack pnpm --filter @workspace/api-worker exec wrangler secret put AI_INTEGRATIONS_OPENAI_API_KEY
corepack pnpm --filter @workspace/api-worker exec wrangler secret put SUPABASE_URL
corepack pnpm --filter @workspace/api-worker exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
corepack pnpm --filter @workspace/api-worker exec wrangler secret put ADMIN_PASSWORD
```

Set non-secret config in `wrangler.toml` or the Cloudflare dashboard:

```text
ALLOWED_ORIGINS=https://your-web-domain.com,capacitor://localhost,ionic://localhost
WEB_APP_URL=https://your-web-domain.com
API_BASE_URL=https://api.your-domain.com/api
SUPABASE_STORAGE_BUCKET=mission-photos
TOSS_CLIENT_KEY=test_or_live_client_key
```

## Frontend Build

Build the web/Capacitor app against this Worker endpoint:

```bash
VITE_API_BASE_URL=https://api.your-domain.com/api corepack pnpm --filter @workspace/bible-pay run cap:sync
```

## Current Caveat

Push subscription endpoints are migrated and subscriptions are stored, but actual
Web Push delivery is left as a follow-up. The previous Express server used the
Node-only `web-push` package; the Worker keeps send calls best-effort/no-op until
VAPID signing or a managed push provider is wired for Workers.
