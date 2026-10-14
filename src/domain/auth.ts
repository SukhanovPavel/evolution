import { z } from "zod";
export type AuthMode =
  "login" | "signup" | "forgot-password" | "reset-password";
export function authSchema(mode: AuthMode) {
  return z
    .object({ email: z.string(), password: z.string() })
    .superRefine((v, ctx) => {
      if (mode !== "reset-password" && !z.email().safeParse(v.email).success)
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "INVALID_EMAIL",
        });
      if (mode !== "forgot-password" && v.password.length < 8)
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "PASSWORD_TOO_SHORT",
        });
    });
}
