---
name: bible-pay splash vs screenshot timing
description: Why app_preview screenshots of bible-pay almost always show only the 5025 logo splash
---

`app_preview` screenshots of bible-pay (any route, incl. `/admin`, `/`) almost always
capture only the centered "5025" logo splash on a white background. This is NOT a hang.

**Why:** `App.tsx` renders a React `<SplashScreen />` overlay while `booting` is true
for a fixed **1300ms** timer, on top of the already-mounted Router. The screenshot tool
loads the page fresh each time and fires before that timer elapses, so it lands inside
the intentional 1.3s boot animation. (Separately, `index.html` has a static `#app-splash`
that `App.tsx` removes on mount — different thing.)

**How to apply:** Don't conclude the app is stuck from a splash-only screenshot. Confirm
real render via browser console signals (e.g. a `password` input autocomplete warning means
the AdminPage form is already in the DOM behind the splash) or verify behavior with curl /
the testing skill instead. The 1.3s splash is by design.
