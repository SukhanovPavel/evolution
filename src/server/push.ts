import "server-only";
import webpush from "web-push";
import { allowedPushEndpoint } from "@/domain/notifications";
import { HttpError } from "@/lib/http";
import { pushPayload } from "@/domain/push-payload";
export { pushPayload } from "@/domain/push-payload";
export function pushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.PUSH_WORKER_SECRET,
  );
}
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  kind: string,
  eventKey: string,
) {
  if (!pushConfigured()) throw new HttpError(503, "PUSH_NOT_CONFIGURED");
  if (!allowedPushEndpoint(subscription.endpoint))
    throw new HttpError(422, "INVALID_PUSH_ENDPOINT");
  return webpush.sendNotification(
    subscription,
    JSON.stringify(pushPayload(kind, eventKey)),
    {
      vapidDetails: {
        subject:
          process.env.NEXT_PUBLIC_APP_URL ??
          "https://evolution-azure.vercel.app",
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
      TTL: 900,
      timeout: 8000,
    },
  );
}
