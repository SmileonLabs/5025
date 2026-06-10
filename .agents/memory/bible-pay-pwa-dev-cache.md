---
name: bible-pay PWA dev cache
description: Why code changes can appear "not applied" in bible-pay's preview — service worker caches an old bundle even in dev.
---

bible-pay is a PWA (vite-plugin-pwa, `injectManifest`, `registerType: "autoUpdate"`) with `devOptions.enabled: true`, so a service worker registers **even in the dev preview** and can serve a previously cached bundle/behavior.

**Why this matters:** When a user reports "the feature didn't change / behaves like the old version," the source code is often already correct. The likely cause is one of:
- a stale service-worker-cached bundle in the browser preview (hard-refresh or reopen the preview to update),
- an **installed** PWA (added to home screen) running its own old cache,
- the **deployed/production** build, which does not get new code until the user republishes.

**How to apply:** Before re-debugging "no change" complaints, verify the code path with grep/e2e first; if the code is correct, suspect cache/deploy and ask the user to hard-refresh or confirm where they're viewing. Don't assume the implementation is broken.

Note: in `sw.ts`, the SPA `NavigationRoute` fallback is registered only under `import.meta.env.PROD`; `CacheFirst` is applied only to Google Fonts. Precaching uses `self.__WB_MANIFEST` (must stay verbatim or the prod build fails).
