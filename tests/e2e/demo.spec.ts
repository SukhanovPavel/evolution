import { test, expect } from "@playwright/test";
test.skip(
  process.env.EVOLUTION_E2E_MODE !== "demo",
  "Use npm run test:demo for isolated fixture build.",
);
test("demo journey: task, check-in, recipe, timer and progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Посмотреть демо" }).click();
  await expect(page.getByText(/Демо с фиксированными/)).toBeVisible();
  await page
    .getByRole("button", { name: /^Выполнить:/ })
    .first()
    .click();
  await expect(page.getByText("25%", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Есть боль" }).check();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Питание", exact: true }).click();
  await page.getByRole("textbox", { name: "Поиск" }).fill("Овсянка");
  await page.getByRole("button", { name: "Подробнее", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Овсяные хлопья");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("link", { name: "Движение", exact: true }).click();
  await page
    .getByRole("link", { name: "Начать →", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const time = await page.getByRole("timer").textContent();
  await page.waitForTimeout(1100);
  await expect(page.getByRole("timer")).toHaveText(time!);
  await page.getByRole("link", { name: "Прогресс", exact: true }).click();
  await expect(
    page.getByText("Первый выполненный шаг", { exact: true }),
  ).toBeVisible();
});
test("onboarding and responsive navigation", async ({ page }) => {
  await page.goto("/onboarding");
  await page
    .getByRole("textbox", { name: "Как к вам обращаться?" })
    .fill("Алекс");
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await page.getByRole("checkbox", { name: /Я понимаю/ }).check();
  await page
    .getByRole("button", { name: "Начать свой путь", exact: true })
    .click();
  await expect(page).toHaveURL(/today/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("API never presents demo as persisted user data", async ({ request }) => {
  const response = await request.get("/api/v1/me");
  expect([401, 503]).toContain(response.status());
  expect((await response.json()).error.code).toBeTruthy();
});

test("PWA fallback caches only public assets", async ({ page, context }) => {
  await page.goto("/today");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys())
      for (const req of await (await caches.open(key)).keys())
        urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(cached).toContain("/offline.html");
  expect(
    cached.every((path) =>
      ["/offline.html", "/icon.svg", "/icon-192.png", "/icon-512.png"].includes(
        path,
      ),
    ),
  ).toBe(true);
  await context.setOffline(true);
  await page.goto("/today");
  await expect(page.getByText(/Сейчас вы без сети/)).toBeVisible();
});
