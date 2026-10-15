import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  error: null as null | Error,
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  serverClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user }, error: mocks.error }),
    },
    from: mocks.from,
  }),
}));
vi.mock("server-only", () => ({}));
import { content } from "@/domain/content";
import { GET, PATCH } from "@/app/api/v1/[...path]/route";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  mocks.user = null;
  mocks.error = null;
  mocks.from.mockReset();
});
const ctx = (path: string) => ({
  params: Promise.resolve({ path: path.split("/") }),
});
describe("API authorization", () => {
  it("rejects anonymous reads before DB access", async () => {
    const r = await GET(
      new NextRequest("http://localhost/api/v1/me"),
      ctx("me"),
    );
    expect(r.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects cross-origin cookie writes", async () => {
    const r = await PATCH(
      new NextRequest("http://localhost/api/v1/me", {
        method: "PATCH",
        headers: { origin: "http://evil.example" },
        body: "{}",
      }),
      ctx("me"),
    );
    expect(r.status).toBe(403);
  });
  it("does not trust arbitrary bearer tokens", async () => {
    mocks.error = new Error("invalid JWT");
    const r = await GET(
      new NextRequest("http://localhost/api/v1/me", {
        headers: { authorization: "Bearer forged" },
      }),
      ctx("me"),
    );
    expect(r.status).toBe(401);
  });
  it("filters profile reads by verified user id", async () => {
    mocks.user = { id: "verified-user" };
    const eq = vi.fn(() => ({
      single: async () => ({
        data: { id: "verified-user", role: "user" },
        error: null,
      }),
    }));
    mocks.from.mockReturnValue({ select: () => ({ eq }) });
    const r = await GET(
      new NextRequest("http://localhost/api/v1/me"),
      ctx("me"),
    );
    expect(r.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("id", "verified-user");
  });
  it("rejects admin writes from normal user", async () => {
    mocks.user = { id: "verified-user" };
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: "verified-user", role: "user" },
            error: null,
          }),
        }),
      }),
    });
    const r = await PATCH(
      new NextRequest(
        "http://localhost/api/v1/admin/recipes/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: { origin: "http://localhost" },
          body: "{}",
        },
      ),
      ctx("admin/recipes/11111111-1111-4111-8111-111111111111"),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("ADMIN_REQUIRED");
  });
});

it("includes bundled image URLs in the authenticated recipe API", async () => {
  mocks.user = { id: "verified-user" };
  const result = { data: content.recipes[0], error: null };
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: async () => result,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  const response = await GET(
    new NextRequest("https://evolution.example/api/v1/recipes/recipe-1"),
    ctx("recipes/recipe-1"),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data.image_url).toBe(
    "https://evolution.example/images/recipes/recipe-1.webp",
  );
});
