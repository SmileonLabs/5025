import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";

// In development, remove any service worker registered by a previous session and
// clear its caches. A stale dev SW (from when devOptions was enabled) can keep
// serving outdated assets and leave the app stuck on the splash screen.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then(async (regs) => {
      if (regs.length === 0) return;
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.location.reload();
    })
    .catch(() => {
      // Best-effort cleanup; ignore failures (e.g. SecurityError in some contexts).
    });
}

// Installed PWAs can stay open for days and keep rendering an older precached
// bundle. Ask the browser to check for a new worker on every launch and reload
// once when the new worker takes control, so children see newly deployed flows
// without clearing their login or browser data manually.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
