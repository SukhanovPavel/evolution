import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defaultNotificationSettings } from "@/domain/notifications";
const calls = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ request: calls.request }));
vi.mock("@/lib/supabase/browser", () => ({ configured: true }));
import { Notifications } from "@/components/Notifications";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("reminder settings", () => {
  it("loads persisted times and saves the user's opt-in and work schedule", async () => {
    calls.request.mockImplementation(async (path: string) =>
      path === "notifications/settings"
        ? {
            settings: { ...defaultNotificationSettings, food_time: "13:45" },
            configured: true,
            publicKey: "test",
            deviceCount: 0,
          }
        : {},
    );
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Notifications />
      </QueryClientProvider>,
    );
    const food = await screen.findByLabelText("Время напоминания о питании");
    expect(food).toHaveValue("13:45");
    fireEvent.click(screen.getByLabelText("Присылать напоминания"));
    fireEvent.change(screen.getByLabelText("Начало рабочего дня"), {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await screen.findByText("Сохранено");
    expect(calls.request).toHaveBeenCalledWith("notifications/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...defaultNotificationSettings,
        enabled: true,
        food_time: "13:45",
        work_start: "10:00",
      }),
    });
  });
  it("does not offer active delivery when server keys are absent", async () => {
    calls.request.mockResolvedValue({
      settings: defaultNotificationSettings,
      configured: false,
      publicKey: null,
      deviceCount: 0,
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Notifications />
      </QueryClientProvider>,
    );
    await screen.findByText(
      "Доставка уведомлений ещё не настроена на сервере.",
    );
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });
});
