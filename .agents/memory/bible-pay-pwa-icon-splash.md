---
name: bible-pay PWA icon & splash auto-update
description: What can and cannot auto-update after a PWA is installed to the home screen, and the in-app splash pattern used here.
---

## Hard constraint — native home-screen icon cannot be force-updated post-install
Once a PWA is added to the home screen, the OS bakes in the launcher ICON at install time. No web/JS/service-worker API can refresh it for an already-installed instance.
- iOS (Safari): icon is fixed at install; only delete + re-add updates it.
- Android (Chrome): periodically re-reads the manifest and CAN update the icon on its own over time (≈daily, applied on next launch) — eventually, not instantly, and not controllable.
The native OS launch/splash (first pre-JS frame, esp. iOS launch screen) is likewise tied to install and not reliably controllable.

**Why:** users kept seeing the old icon after a rebrand and asked for auto-update; this is an OS limitation, so be honest rather than promising the impossible.

## What IS auto-updating (no reinstall)
- App CONTENT (HTML/JS/CSS + in-app images like `public/logo.png` shown on login/appinfo) auto-updates every deploy via `registerType: "autoUpdate"` + the auto-injected `registerSW.js` (vite-plugin-pwa), backed by `skipWaiting()` + `clientsClaim()` in `src/sw.ts`. No manual registration code exists in the app — the plugin injects it (`injectRegister` default).

## In-app splash pattern (always current)
A two-part in-app splash makes the launch logo always reflect the latest deploy: a static frame in `index.html` for an instant pre-JS paint, handed off to a matching React splash overlay. Keep the React splash image pixel-identical at mount (same size, opacity 1) so there's no blink at the hand-off.
**How to apply:** to change the launch image, just swap `public/logo.png` — both splashes pick it up on the next launch after deploy (autoUpdate applies on the launch after the update, not the same launch).
