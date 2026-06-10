---
name: drizzle-kit push blocked without a TTY
description: How to apply schema changes when `drizzle-kit push` hangs on an interactive prompt in this no-TTY environment.
---

`pnpm --filter @workspace/db run push` (drizzle-kit push) can hang/fail in this
environment because it opens an interactive resolver prompt
(`promptNamedWithSchemasConflict`, create-vs-rename) that needs a TTY. `--force`
does NOT skip it. Piping `yes '' | script -qec "...push" /dev/null` makes it
worse: the ink-based UI redraws in an infinite loop and the command times out.

**Workaround that works:** apply the equivalent DDL directly via `executeSql`
(code_execution sandbox), matching drizzle's generated naming so a later `push`
diffs clean and never re-prompts.

drizzle naming conventions to mirror:
- FK: `<table>_<col>_<reftable>_<refcol>_fk`
- unique: `<table>_<col1>_<col2>_unique`
- PK: `<table>_pkey` (postgres default)
- serial seq: `<table>_<col>_seq` (auto)

Use `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` for idempotency,
then verify with `information_schema.columns` and `pg_constraint`.

**Why:** the agent environment has no interactive terminal; drizzle's resolver
can't be answered. Direct DDL with matching names keeps the schema file as the
source of truth without diverging from what push would have produced.

**How to apply:** when adding a new column/table and push blocks on a prompt,
write the DDL by hand (mirroring the names above) and run it through executeSql.
This is the built-in Postgres DB, so no connector confirmation is needed.
