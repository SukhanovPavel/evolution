import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
const calls = vi.hoisted(() => ({
  reset: vi.fn(async () => ({ error: null })),
  update: vi.fn(async () => ({ error: null })),
  resend: vi.fn(async () => ({ error: null })),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  configured: true,
  browserClient: () => ({
    auth: {
      resetPasswordForEmail: calls.reset,
      updateUser: calls.update,
      resend: calls.resend,
    },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: calls.replace, refresh: calls.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
import { AuthForm } from "@/components/AuthForm";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("password recovery UI", () => {
  it("resends confirmation to the configured production callback", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://evolution-azure.vercel.app");
    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText("Электронная почта"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Отправить подтверждение повторно" }),
    );
    await vi.waitFor(() =>
      expect(calls.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "test@example.com",
        options: {
          emailRedirectTo: "https://evolution-azure.vercel.app/auth/callback",
        },
      }),
    );
    vi.unstubAllEnvs();
  });
  it("submits an email without a hidden fake password", async () => {
    render(<AuthForm mode="forgot-password" />);
    fireEvent.change(screen.getByLabelText("Электронная почта"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить ссылку" }));
    await screen.findByText(/Проверьте почту. Если адрес зарегистрирован/);
    expect(calls.reset).toHaveBeenCalledWith("test@example.com", {
      redirectTo: expect.stringContaining(
        "/auth/callback?next=/reset-password",
      ),
    });
  });
  it("saves a new password without requiring a hidden email", async () => {
    render(<AuthForm mode="reset-password" />);
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "new-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить пароль" }));
    await vi.waitFor(() =>
      expect(calls.update).toHaveBeenCalledWith({
        password: "new-test-password",
      }),
    );
    expect(calls.replace).toHaveBeenCalledWith("/today");
  });
});
