import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
const calls = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: calls.rpc }),
}));
vi.mock("@/server/push", () => ({
  pushConfigured: () => true,
  sendPush: calls.send,
}));
import { POST } from "@/app/api/v1/notifications/dispatch/route";
const job = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "food",
  event_key: "2026-10-14:12:30:food",
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: "test", auth: "test" },
};
beforeEach(() => {
  vi.stubEnv("PUSH_WORKER_SECRET", "test-worker-secret-long-enough-123456789");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  calls.rpc.mockReset();
  calls.send.mockReset();
  calls.rpc.mockImplementation(async (name: string) => ({
    data: name === "claim_push_deliveries" ? [job] : null,
    error: null,
  }));
  calls.send.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());
const req = (token?: string) =>
  new NextRequest(
    "https://evolution-azure.vercel.app/api/v1/notifications/dispatch",
    {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    },
  );
describe("push delivery worker", () => {
  it("rejects public and incorrect-token requests before accessing subscriptions", async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("wrong"))).status).toBe(401);
    expect(calls.rpc).not.toHaveBeenCalled();
  });
  it("acknowledges successful delivery without returning endpoints/keys", async () => {
    const r = await POST(req(process.env.PUSH_WORKER_SECRET));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { processed: 1, sent: 1 } });
    expect(calls.rpc).toHaveBeenCalledWith("finish_push_delivery", {
      p_secret: process.env.PUSH_WORKER_SECRET,
      p_id: job.id,
      p_result: "sent",
    });
  });
  it("removes expired provider subscriptions", async () => {
    calls.send.mockRejectedValue({ statusCode: 410 });
    expect((await POST(req(process.env.PUSH_WORKER_SECRET))).status).toBe(200);
    expect(calls.rpc).toHaveBeenCalledWith("finish_push_delivery", {
      p_secret: process.env.PUSH_WORKER_SECRET,
      p_id: job.id,
      p_result: "expired",
    });
  });
  it("leases transient failures for bounded retry", async () => {
    calls.send.mockRejectedValue({ statusCode: 503 });
    await POST(req(process.env.PUSH_WORKER_SECRET));
    expect(calls.rpc).toHaveBeenCalledWith("finish_push_delivery", {
      p_secret: process.env.PUSH_WORKER_SECRET,
      p_id: job.id,
      p_result: "failed",
    });
  });
});
