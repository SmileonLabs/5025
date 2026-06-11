---
name: bible-pay bottom-sheet modal z-index vs BottomNav
description: Why tall bottom-sheet modals get their lower content clipped, and the z-index rule that prevents it.
---

`BottomNav` is `position: fixed; bottom-0; z-50`. The bottom-sheet modals (SpendModal, ChildCreate, NotificationSettings, etc.) historically also used `z-50` for both backdrop and sheet, AND they're rendered in the page tree BEFORE `<BottomNav />`. With equal z-index the later-painted nav wins, so the nav overlays the bottom ~80px (h-16 + safe-area) of the sheet.

- Short modals never noticed: their content fits in the area above the nav.
- TALL modals (mission/transaction detail with quiz + reflection + photo) get their lower content hidden behind the nav, and because the scroll viewport's bottom edge is itself behind the nav, `overflow-y-auto` can't bring that last band into view — it's permanently dead space.

**Rule:** any bottom-sheet modal that can hold tall/scrolling content must set backdrop + sheet to `z-[60]` (above the nav's z-50) so the opaque sheet covers the nav and the full content scrolls. The detail modals (`MissionLogDetailModal`, `TransactionDetailModal`) already do.

**Why:** pages here have no transformed ancestor around the sheet, so a plain higher z-index beats the nav — no portal needed. If a future page wraps content in a `transform`/`filter` ancestor, `fixed` + z-index alone won't escape it; switch that modal to a `createPortal(document.body)` instead.
