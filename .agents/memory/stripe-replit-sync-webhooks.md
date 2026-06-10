---
name: stripe-replit-sync managed webhooks
description: Why custom per-event webhook business logic does not work with Replit-managed Stripe + stripe-replit-sync, and where the signing secret actually lives.
---

# Managed Stripe webhooks (stripe-replit-sync)

When Stripe is connected via the Replit integration and the server uses
`stripe-replit-sync` with `findOrCreateManagedWebhook`:

- The Replit-managed Stripe **connection settings expose `secret` (API key) and
  `publishable`, but NOT `webhook_secret`.** Observed settings keys:
  `account_id, claim_url, claimed_at, mcp, publishable, secret`.
- The managed webhook's signing secret is stored in **stripe-replit-sync's own
  migrated tables**, not in the Replit connection. You cannot fetch it to call
  `stripe.webhooks.constructEvent(...)` yourself.
- `StripeSync.processWebhook(payload, signature)` returns `void`. It exposes
  **no verified event object and no per-event handler hook** — it only syncs
  Stripe objects into the library's tables. (In managed mode it tolerates an
  empty `stripeWebhookSecret` because it verifies using its internally-stored
  secret.)

**Implication / how to apply:** Do not try to run custom business logic (e.g.
crediting a balance) directly off a managed webhook event — re-verifying throws
"webhook secret not configured" on every event since `settings.webhook_secret`
is empty. For crediting, use the **redirect-confirm pattern**: Checkout
`success_url` returns to your own endpoint that calls
`stripe.checkout.sessions.retrieve(id)` (authoritative) and credits idempotently
(unique `stripe_session_id` row + `onConflictDoNothing`, then atomic balance
bump only if a row was inserted).

**Why:** Spent >2 attempts wiring webhook-side crediting before discovering the
secret/event simply aren't reachable in managed mode. If webhook-driven logic is
ever truly required, the only route is reading synced rows from the library's own
tables after `processWebhook` — i.e. coupling to library internals.
