---
name: bible-pay DB schema changes
description: How to apply Drizzle schema changes in this repo when drizzle-kit push fails.
---

`pnpm --filter @workspace/db run push` (drizzle-kit push) hangs/fails in the agent environment because it shows an interactive TTY prompt that cannot be answered non-interactively.

**Workaround:** Apply additive schema changes (new columns, new tables) directly via SQL — `executeSql` in code_execution, or `psql "$DATABASE_URL"`. Keep the Drizzle schema files in sync so generated types/zod stay correct.

**How to apply:** After editing `lib/db/src/schema/*`, run the equivalent `ALTER TABLE` / `CREATE TABLE` SQL yourself rather than relying on push.
