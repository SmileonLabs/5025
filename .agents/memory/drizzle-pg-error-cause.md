---
name: drizzle pg error code is on e.cause
description: drizzle-orm wraps driver errors in DrizzleQueryError, so the pg DatabaseError.code (e.g. '23505' unique_violation) is NOT on the thrown error — it's on e.cause.
---

# drizzle-orm hides pg error codes under `e.cause`

When a query throws inside drizzle-orm (node-postgres driver), the error you catch is a
`DrizzleQueryError` whose own shape is only `{ query, params, cause }` — it has **no `.code`**.
The real `pg` `DatabaseError` (with `.code === '23505'` for unique_violation, `'23503'` FK, etc.)
is nested at `error.cause`.

**Why:** A catch that does `if (e.code === '23505')` silently never matches → the error
re-throws as an unhandled 500 instead of being mapped to its intended response (e.g. 409 duplicate).
This is invisible in normal testing because route-level pre-checks usually catch the duplicate
first; the DB unique-index backstop path only runs under true concurrent races, so the broken
mapping ships unnoticed.

**How to apply:** When detecting a specific Postgres error code from a drizzle query, walk the
cause chain, don't read `.code` off the top-level error:

```ts
function hasPgCode(e: unknown, code: string): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur != null; i++) {
    if (typeof cur === "object" && (cur as { code?: string }).code === code) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
```

To actually exercise this path in a test, fire two identical writes with `Promise.all` so one
loses the unique-index race (pre-checks pass for both, then the second insert violates the index).
