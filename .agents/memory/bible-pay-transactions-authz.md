---
name: bible-pay transactions authorization
description: Access-control rules enforced on POST /api/transactions
---

# POST /api/transactions authorization

This generic endpoint creates transactions and mutates balances, so type-driven rules are enforced (a child must never be able to credit their own balance):

- Caller must be the child's parent OR that child (session-based). Otherwise 403.
- `type: "mission"` → **rejected (403)**. Mission rewards are issued server-side only by the missions routes; never client-supplied here.
- `type: "charge"` (top-up) → **parent-only**, `amount > 0`, and the parent's own balance must cover it (else 400 "부모님 잔액이 부족해요"). Parent balance is deducted before crediting the child.
- `type: "spend"` → `amount < 0` required, and cannot overdraw (`child.balance + amount >= 0`).

**Why:** previously type/sign/role were unvalidated, so a child could POST a positive `charge`/`mission` (or positive `spend`) to inflate their own balance, and charges credited the child even when the parent lacked funds.

Frontend only ever posts `charge` (positive) and `spend` (negative) from AppContext, so these rules don't break existing flows.
