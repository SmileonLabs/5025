---
name: bible-pay mission result in transactions
description: Where a completed mission's result lives and how transaction detail surfaces it.
---

A mission transaction's RESULT (read passage, reflection/묵상 note, status, mission title) is NOT stored on the `transactions` row — it lives in `mission_logs`, linked by `mission_logs.transaction_id = transactions.id`.

- Both reward flows set that link: bible/auto missions at completion, confirm-type at parent approval.
- To show a mission result for a transaction, leftJoin `mission_logs` on `transaction_id` (+ `missions` for the title). No schema change / no duplication onto `transactions` is needed.

**Gotcha (not derivable from code — a data-state fact):** older `mission_logs` rows can have an empty/null `reflection` (created before reflection was required). Any detail UI must render gracefully when reflection is missing — only show the 묵상 노트 / "퀴즈 통과" badge when a reflection actually exists.

**Why:** the quiz Q&A itself is never persisted (generated on the fly by OpenAI); reward issuance already gates on passing the quiz server-side, so "퀴즈 통과" is inferred from the presence of a reflection, not from stored answers.
