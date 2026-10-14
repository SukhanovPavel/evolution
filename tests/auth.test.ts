import { describe, it, expect } from "vitest";
import { authSchema } from "@/domain/auth";
describe("auth form modes", () => {
  it("password reset request needs only email", () =>
    expect(
      authSchema("forgot-password").safeParse({
        email: "a@example.com",
        password: "",
      }).success,
    ).toBe(true));
  it("new password does not need a fake email", () =>
    expect(
      authSchema("reset-password").safeParse({
        email: "",
        password: "long-password",
      }).success,
    ).toBe(true));
  it("rejects invalid login email and short signup password", () => {
    expect(
      authSchema("login").safeParse({ email: "bad", password: "long-password" })
        .success,
    ).toBe(false);
    expect(
      authSchema("signup").safeParse({
        email: "a@example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });
});
