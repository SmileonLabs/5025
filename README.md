# 5025 Bible Reward Wallet

부모가 예산을 충전하고 자녀가 성경·생활 미션을 수행해 포인트를 받는 가족용 지갑 PWA입니다. 자녀는 적립한 포인트로 부모가 등록한 기프티콘을 요청할 수 있습니다.

## Production architecture

- Web/PWA: `artifacts/bible-pay` (React, Vite, Capacitor)
- Canonical API: `artifacts/api-server` (Express 5)
- Database: Replit PostgreSQL with Drizzle ORM
- Production URL: `https://bible-wallet.replit.app`
- `artifacts/api-worker` is an experimental Cloudflare Worker adapter and is not the Replit production runtime. New business rules must be implemented in the canonical API first and ported with parity tests before Worker deployment.

## Local development

Requirements: Node.js 24 and pnpm 10.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/bible-pay run dev
```

## Required production secrets

Configure these with Replit Secrets; never commit their values:

- `DATABASE_URL`
- `SESSION_SECRET` (at least 32 random characters)
- `ADMIN_PASSWORD`
- `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- OpenAI integration credentials used by the quiz route

Required non-secret production configuration:

```text
NODE_ENV=production
WEB_APP_URL=https://bible-wallet.replit.app
ALLOWED_ORIGINS=https://bible-wallet.replit.app,capacitor://localhost,ionic://localhost
```

## Validation

```bash
pnpm run typecheck
pnpm run test
pnpm -r --if-present run build
```

Every pull request runs the same checks in GitHub Actions.

## Payments

Top-up confirmation is server-authoritative and idempotent. Register the Toss Payments `PAYMENT_STATUS_CHANGED` webhook at:

```text
https://bible-wallet.replit.app/api/topups/webhook/toss
```

The webhook payload is not trusted directly. The server re-queries Toss using the payment key, verifies order ID and amount against the pending top-up, and credits it once.

## Database changes

Use reviewed Drizzle migrations for production. `push` is development-only and `push-force` must never be used against production. See `lib/db/migrations/README.md`.
