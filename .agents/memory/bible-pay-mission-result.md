---
name: bible-pay mission result in transactions
description: Where a completed mission's result lives, how transaction detail surfaces it, and the standalone mission-log history screen.
---

A mission's RESULT (read passage, reflection/묵상 note, quiz snapshot, photo, status, mission title) lives in `mission_logs`, NOT on the `transactions` row. A reward transaction links via `mission_logs.transaction_id = transactions.id`.

- Both reward flows set that link: bible missions at completion (immediate), activity missions at parent approval.
- Transaction detail surfaces a mission result by leftJoin `mission_logs` on `transaction_id` (+ `missions` for the title).
- There is also a STANDALONE history screen separate from the ledger: `GET /api/mission-logs` is session-scoped (child→own, parent→all their children's; no client-supplied childId/parentId → no IDOR) and inlines the detail fields. Both parent and child get a list + detail modal; the shared presentational piece is `MissionResultContent`, reused by both the log modal and the transaction modal.

**Quiz snapshot:** the bible quiz Q&A IS now persisted as a display-only snapshot in `mission_logs.quiz` (jsonb, questions only — no chosen answers). It is best-effort: parsed INDEPENDENTLY of the reward gate (book/chapter/reflection) so a malformed quiz never blocks mission completion — on validation failure only the quiz is dropped, the reward still issues.

**Why:** reward issuance gates server-side on book/chapter + a ≥5-char reflection, not on the quiz; the quiz is purely for showing the parent/child what was asked. Folding its zod into the same body parse once caused a misleading 400 that blocked completion — keep display-only snapshots out of reward-gating validation.

**Gotcha (data-state, not code):** legacy `mission_logs` rows predate both reflection and quiz, so either can be null. Detail UI must render gracefully — when `quiz` is null but it's a bible log with a reflection, fall back to a "퀴즈 통과" badge instead of listing questions.
