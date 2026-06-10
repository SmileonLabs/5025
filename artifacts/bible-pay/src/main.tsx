import { createRoot } from "react-dom/client";
import App from "./App";
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

createRoot(document.getElementById("root")!).render(<App />);
