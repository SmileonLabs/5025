---
name: bible-pay parent vs child state scoping
description: How AppContext separates parent-scoped vs child-scoped transaction state in the 성경 용돈 app.
---

AppContext holds two separate transaction arrays:
- `transactions` — child-scoped, only populated on child login/restore (GET /transactions).
- `parentTransactions` — parent-scoped, populated on parent login/restore (GET /transactions/all across all children).

**Rule:** Any parent-facing screen (DashboardPage, HistoryPage) must read `parentTransactions`, never `transactions`.

**Why:** On a parent session `transactions` is empty, so a parent screen sourcing recent activity from `transactions` silently renders nothing (e.g. "최근 완료한 미션" + its 더보기 button vanished).

**How to apply:** When showing any cross-child activity to a parent, use `parentTransactions` and call `refreshParentTransactions()` if the screen can be entered without a fresh login.
