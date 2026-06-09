/* Custom service worker (vite-plugin-pwa injectManifest strategy).
 * Adds Web Push handling on top of Workbox precaching so the parent can
 * receive notifications even when the app is closed. */
import { precacheAndRoute, createHandlerBoundToURL, type PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

// `self.__WB_MANIFEST` is the literal injection point that vite-plugin-pwa (workbox)
// replaces with the precache manifest at build time — it MUST appear verbatim in the
// source, otherwise the production build fails with "Unable to find a place to inject
// the manifest". Declaring it on the global scope keeps that literal token type-safe.
declare global {
  // eslint-disable-next-line no-var
  var __WB_MANIFEST: Array<PrecacheEntry | string>;
}

// DOM/webworker lib provides ServiceWorkerGlobalScope / PushEvent / NotificationEvent.
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.skipWaiting();
clientsClaim();

// Precache build assets injected by vite-plugin-pwa at build time.
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback (precache only contains index.html in production builds).
if (import.meta.env.PROD) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL("index.html"), {
      denylist: [/^\/api/],
    }),
  );
}

// Cache Google Fonts aggressively (they are immutable).
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

interface PushData {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
}

sw.addEventListener("push", (event: PushEvent) => {
  let data: PushData = {};
  try {
    data = event.data ? (event.data.json() as PushData) : {};
  } catch {
    data = { body: event.data?.text() };
  }

  const title = data.title || "성경 용돈";
  const options: NotificationOptions = {
    body: data.body || "",
    icon: data.icon || "pwa-192.svg",
    badge: "pwa-192.svg",
    data: { url: data.url || sw.registration.scope },
  };

  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && (event.notification.data as { url?: string }).url) || sw.registration.scope;

  event.waitUntil(
    (async () => {
      const allClients = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      if (sw.clients.openWindow) {
        await sw.clients.openWindow(targetUrl);
      }
    })(),
  );
});
