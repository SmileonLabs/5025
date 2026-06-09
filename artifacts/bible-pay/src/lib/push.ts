import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getPushPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // vite-plugin-pwa registers the SW; wait until it's ready.
  return navigator.serviceWorker.ready;
}

export type PushEnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "error" };

/** Request permission and register this device for push with the backend. */
export async function enablePush(): Promise<PushEnableResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const { publicKey } = await api.get<{ publicKey: string }>("/push/public-key");
    const registration = await getRegistration();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    await api.post("/push/subscribe", {
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });

    return { ok: true };
  } catch (err) {
    console.error("enablePush failed", err);
    return { ok: false, reason: "error" };
  }
}

/** Unsubscribe this device from push. */
export async function disablePush(): Promise<void> {
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api.post("/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error("disablePush failed", err);
  }
}

/** Whether this device currently has an active push subscription. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported() || getPushPermission() !== "granted") return false;
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
