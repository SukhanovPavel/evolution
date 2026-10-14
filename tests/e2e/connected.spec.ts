import { test, expect, Page } from "@playwright/test";
test.describe("real Supabase critical journeys", () => {
  test.skip(
    process.env.EVOLUTION_E2E_CONNECTED !== "1",
    "Requires a configured test Supabase project and two test accounts",
  );
  async function login(page: Page, second = false) {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Электронная почта" })
      .fill(
        process.env[
          second ? "EVOLUTION_TEST_EMAIL_2" : "EVOLUTION_TEST_EMAIL"
        ]!,
      );
    await page
      .getByLabel("Пароль", { exact: true })
      .fill(
        process.env[
          second ? "EVOLUTION_TEST_PASSWORD_2" : "EVOLUTION_TEST_PASSWORD"
        ]!,
      );
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/today/);
  }
  test("onboarding, persistence, check-in and data export", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Далее", exact: true }).click();
    await page.getByRole("button", { name: "Далее", exact: true }).click();
    await page.getByRole("checkbox", { name: /Я понимаю/ }).check();
    await page.getByRole("button", { name: "Начать свой путь" }).click();
    await expect(
      page
        .getByRole("button", { name: /^(Выполнить|Вернуть в план):/ })
        .first(),
    ).toBeVisible();
    const plan = await (await page.request.get("/api/v1/daily-plan")).json();
    const task = plan.data.daily_tasks[0];
    const update = await page.request.patch(`/api/v1/daily-tasks/${task.id}`, {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { status: "completed" },
    });
    expect(update.status()).toBe(200);
    await page.reload();
    const repeated = await (
      await page.request.get("/api/v1/daily-plan")
    ).json();
    expect(repeated.data.id).toBe(plan.data.id);
    expect(
      repeated.data.daily_tasks.find((t: { id: string }) => t.id === task.id)
        .status,
    ).toBe("completed");
    await page.getByRole("checkbox", { name: "Есть боль" }).check();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
    const exported = await page.request.get("/api/v1/data/export");
    expect(exported.status()).toBe(200);
    expect((await exported.json()).data.daily_plans.length).toBeGreaterThan(0);
  });
  test("another user cannot read/update task; non-admin cannot write catalog", async ({
    page,
    browser,
  }) => {
    await login(page);
    const plan = await (await page.request.get("/api/v1/daily-plan")).json();
    test.skip(!plan.data, "Run onboarding on test account first");
    const context = await browser.newContext();
    const second = await context.newPage();
    await login(second, true);
    const r = await second.request.patch(
      `/api/v1/daily-tasks/${plan.data.daily_tasks[0].id}`,
      {
        headers: { origin: "http://127.0.0.1:3000" },
        data: { status: "completed" },
      },
    );
    expect(r.status()).toBe(404);
    const admin = await second.request.post("/api/v1/admin/recipes", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: {},
    });
    expect(admin.status()).toBe(403);
    await context.close();
  });
});
