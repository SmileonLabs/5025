import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const publicKey = process.env["VAPID_PUBLIC_KEY"];
const privateKey = process.env["VAPID_PRIVATE_KEY"];
const subject = process.env["VAPID_SUBJECT"] ?? "mailto:noreply@bible-pay.app";

let configured = false;
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
} else {
  logger.warn("VAPID keys are not set; web push notifications are disabled.");
}

export function getVapidPublicKey(): string | null {
  return configured ? publicKey! : null;
}

export function isPushConfigured(): boolean {
  return configured;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a web push notification to every device a parent has registered.
 * Subscriptions that the push service rejects as gone (404/410) are pruned.
 * Failures are logged but never thrown — push is best-effort and must not
 * break the triggering action (mission reward, spend, etc.).
 */
export async function sendPushToParent(parentId: number, payload: PushPayload): Promise<void> {
  if (!configured) return;

  try {
    await deliverToParent(parentId, payload);
  } catch (err) {
    logger.error({ err, parentId }, "sendPushToParent failed.");
  }
}

async function deliverToParent(parentId: number, payload: PushPayload): Promise<void> {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.parentId, parentId));

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
          logger.info({ parentId, endpoint: sub.endpoint }, "Pruned expired push subscription.");
        } else {
          logger.error({ err, parentId }, "Failed to send web push notification.");
        }
      }
    }),
  );
}
