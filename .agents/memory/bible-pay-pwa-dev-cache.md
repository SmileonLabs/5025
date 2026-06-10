---
name: bible-pay PWA dev cache
description: bible-pay disables the service worker in dev (devOptions.enabled:false) because a dev SW caused stale-bundle / blank-screen hangs; how to debug "didn't change" complaints.
---

bible-pay is a PWA (vite-plugin-pwa, `injectManifest`, `registerType: "autoUpdate"`). The **service worker is disabled in development** (`devOptions.enabled: false` in `vite.config.ts`).

**Why dev SW is off:** With it enabled, `sw.ts` (`skipWaiting()` + `clientsClaim()`) seized control of every tab and, together with Vite HMR, served outdated module chunks — the app got stuck on the boot splash / blank screen, and earlier changes appeared "not applied." `main.tsx` now self-heals: in dev (`import.meta.env.DEV`) it unregisters any leftover SW, clears caches, and reloads once.

**Debugging "feature didn't change / blank screen":** The dev preview no longer uses a SW, so suspect these instead:
- an **installed** PWA (added to home screen) running its own old cache,
- the **deployed/production** build, which only updates after the user republishes,
- a badly wedged tab where the self-heal JS never ran → one manual hard-refresh on the user's device.
Verify the code path (grep/e2e) before assuming the implementation is broken.

**Production SW still ships:** `sw.ts` handles Web Push, precache (`self.__WB_MANIFEST` — keep verbatim or the prod build fails), and offline. The SPA `NavigationRoute` fallback is registered only under `import.meta.env.PROD`; `CacheFirst` applies only to Google Fonts.
