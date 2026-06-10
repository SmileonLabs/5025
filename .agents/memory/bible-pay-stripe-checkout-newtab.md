---
name: bible-pay Stripe Checkout opens in a new tab
description: Why budget top-up opens Stripe Checkout in a separate tab and syncs balance cross-tab, instead of redirecting the current tab.
---

bible-pay's parent budget top-up opens Stripe Checkout in a **new browser tab**, not via `window.location.href` on the current tab.

**Why:** Stripe Checkout refuses to render inside an iframe (`X-Frame-Options`), and the app commonly runs embedded (the Replit canvas iframe, and a preview pane). A same-tab redirect inside the iframe just fails. So `startTopupCheckout` opens the tab instead.

**How to apply (two non-obvious constraints):**
- Open the tab synchronously inside the click handler *before* any `await` (`window.open("about:blank","_blank")`, then fetch the session URL and set the tab's `location`). If you `await` first and open after, the popup blocker kills it. A null return means blocked → surface a toast asking the user to allow popups.
- Because payment completes in a *separate* tab, the original (embedded) tab won't see the credit on its own. Use a same-origin `BroadcastChannel` ("bible-pay-topup"): the returning tab confirms via `POST /api/topups/confirm` (server-authoritative balance) and broadcasts `{type:"topup-success", balance, amount}`; every open tab updates its balance live. Post through the *same* channel instance that owns `onmessage` so the sender doesn't re-toast itself. Broadcast on both the freshly-credited path AND the already-credited (webhook-race) path, or the embedded tab stays stale.

**Why this matters for "I paid but the balance didn't change":** that complaint is now most likely the embedded tab not receiving the broadcast (or an un-republished prod), NOT a broken credit — the server credits idempotently via the unique stripe_session_id.
