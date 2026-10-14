import { describe, it, expect } from "vitest";
import {
  preferencesSchema,
  defaults,
  profileSchema,
  dateSchema,
} from "@/domain/schemas";
describe("validation", () => {
  it("requires safety gate for cold education", () => {
    expect(
      preferencesSchema.safeParse({ ...defaults, cold_opt_in: true }).success,
    ).toBe(false);
  });
  it("rejects invalid timezone and impossible date", () => {
    expect(profileSchema.safeParse({ timezone: "Mars" }).success).toBe(false);
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
  });
  it("accepts minimal preferences", () =>
    expect(preferencesSchema.safeParse(defaults).success).toBe(true));
});
