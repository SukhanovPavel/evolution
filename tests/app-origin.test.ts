import { afterEach, describe, it, expect, vi } from "vitest";
import { appOrigin } from "@/lib/app-origin";
afterEach(() => vi.unstubAllEnvs());
describe("authentication redirect origin", () => {
  it("uses the configured production origin instead of localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://evolution-azure.vercel.app");
    expect(appOrigin("http://localhost:3000")).toBe(
      "https://evolution-azure.vercel.app",
    );
  });
  it("uses the current origin in unconfigured development", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appOrigin("http://localhost:3000/test")).toBe(
      "http://localhost:3000",
    );
  });
  it("rejects unsafe configured URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
    expect(() => appOrigin("https://example.com")).toThrow();
  });
});
