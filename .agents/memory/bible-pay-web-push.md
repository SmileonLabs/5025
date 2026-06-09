---
name: bible-pay web push
description: Web Push (VAPID + service worker) setup constraints for the bible-pay PWA
---

# bible-pay Web Push

Parents receive true web push when a child earns (mission reward) or spends allowance.

## Service worker must stay enabled in dev
- The frontend workflow runs `vite` dev, not a production build. A service worker only loads in dev if `VitePWA({ devOptions: { enabled: true } })`. Push REQUIRES a SW, so devOptions must stay enabled or push can't be tested/used in the Replit preview.
- **Why:** without it there is no SW in the dev preview → `navigator.serviceWorker.ready` never resolves → subscription impossible.

## injectManifest custom SW + TypeScript
- The custom SW (`src/sw.ts`) uses `strategies: "injectManifest"`. It must be EXCLUDED from the app's main tsconfig (which uses `lib: dom`) and typechecked via a separate `tsconfig.sw.json` with `lib: ["esnext","webworker"]`. Otherwise `ServiceWorkerGlobalScope` members (skipWaiting, addEventListener, PushEvent, NotificationEvent, registration, clients) error out, because dom lib declares the interface name but not its members.
- The `typecheck` script chains both: `tsc -p tsconfig.json && tsc -p tsconfig.sw.json`.

## injectManifest needs the literal `self.__WB_MANIFEST` token (dev hides this)
- workbox does a plain TEXT search of `src/sw.ts` for the exact substring `self.__WB_MANIFEST` and replaces it with the precache list at build. If the source casts `self` (e.g. `(self as unknown as {...}).__WB_MANIFEST`), the contiguous token is absent → **production build fails** with `Unable to find a place to inject the manifest`.
- **Dev mode skips manifest injection**, so this only surfaces at publish/`vite build` — typecheck alone won't catch it. Always run a real production build (`PORT=23209 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/bible-pay run build`) before publishing SW changes.
- Fix that keeps the literal token AND typechecks under webworker lib: `declare global { var __WB_MANIFEST: Array<PrecacheEntry | string> }` then call `precacheAndRoute(self.__WB_MANIFEST)` (use a separate `sw` cast only for the ServiceWorker APIs). Do NOT redeclare `self` (TS2451 conflict with the lib).

## Transient SW error after dep changes
- Right after adding/changing workbox deps, vite re-optimizes and triggers a one-time reload that logs `Failed to register a ServiceWorker ... dev-sw.js: ServiceWorker cannot be started`. This is transient — gone on the next clean load. Don't chase it as a real bug; reload and re-check.

## VAPID keys
- Stored as shared env vars `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (secrets can't be set programmatically; these are app-generated, not user secrets). Generated with Node `crypto.createECDH('prime256v1')` + base64url. Frontend fetches the public key from `GET /api/push/public-key`.

## Notify-on-approval is intentionally skipped
- Confirm-type missions push the parent at SUBMISSION ("승인 요청"), NOT at approval — approval is the parent's own action, so a push there would be self-notification noise. Bible/auto missions push at immediate reward; spend pushes on `type==="spend"`.

## Can't be E2E-tested by tooling
- Full push delivery needs a real browser permission grant + real subscription (and iOS requires PWA added to home screen). Verify pipeline pieces (public-key endpoint, SW served with handlers, clean console) but the final grant+delivery is user-device testing.
