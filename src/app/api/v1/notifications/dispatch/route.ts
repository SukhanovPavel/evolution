import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { checked, fail, HttpError, ok } from "@/lib/http";
import { pushConfigured, sendPush } from "@/server/push";
export const runtime = "nodejs";
export const maxDuration = 60;
type Delivery = {
  id: string;
  kind: string;
  event_key: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.PUSH_WORKER_SECRET;
    const token =
      req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (
      !secret ||
      Buffer.byteLength(secret) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(token))
    )
      throw new HttpError(401, "UNAUTHORIZED");
    if (!pushConfigured()) throw new HttpError(503, "PUSH_NOT_CONFIGURED");
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const deliveries = checked(
      await client.rpc("claim_push_deliveries", { p_secret: secret }),
    ) as Delivery[];
    let sent = 0;
    for (let i = 0; i < deliveries.length; i += 10) {
      await Promise.all(
        deliveries.slice(i, i + 10).map(async (delivery) => {
          let result = "sent";
          try {
            await sendPush(delivery, delivery.kind, delivery.event_key);
            sent++;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            result = status === 404 || status === 410 ? "expired" : "failed";
          }
          checked(
            await client.rpc("finish_push_delivery", {
              p_secret: secret,
              p_id: delivery.id,
              p_result: result,
            }),
          );
        }),
      );
    }
    return ok({ processed: deliveries.length, sent });
  } catch (error) {
    return fail(error);
  }
}
