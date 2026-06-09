---
name: bible-pay lib/api typecheck noise
description: Pre-existing typecheck failures unrelated to app code in this repo.
---

`pnpm run typecheck:libs` and `pnpm --filter @workspace/api-server run typecheck` fail with errors in `lib/integrations-openai-ai-server` and `lib/integrations-openai-ai-react` (cannot find module 'openai'/'p-limit'/'react'/'node:fs', missing @types/node). These are pre-existing and unrelated to feature work.

**Consequence:** api-server typecheck also fails (TS6305: openai lib dist not built) because the lib build is blocked.

**How to verify your own work despite this:** Runtime is unaffected — the api-server workflow builds via esbuild/tsx, not tsc. For frontend changes, rely on `pnpm --filter @workspace/bible-pay run typecheck` (clean). Treat the integrations-openai lib errors as background noise unless the task is specifically about those libs.
