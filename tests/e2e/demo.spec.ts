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

test("program day expands across the week and closes the previous day", async ({
  page,
}) => {
  await page.goto("/program");
  const first = page.getByRole("button", { name: /^День 1(?: •)?$/ });
  const second = page.getByRole("button", { name: /^День 2(?: •)?$/ });
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("#program-week-0");
  await expect(panel).toContainText("Домашняя силовая тренировка");
  await expect(panel).toContainText("Завтрак");
  await expect(panel).toContainText("Обед");
  await expect(panel).toContainText("Ужин");
  const width = await panel.evaluate((el) => el.getBoundingClientRect().width);
  const cardWidth = await panel.evaluate(
    (el) => el.parentElement!.getBoundingClientRect().width,
  );
  expect(width / cardWidth).toBeGreaterThan(0.75);
  await second.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByRole("heading")).toHaveText("День 2");
  await page.getByRole("button", { name: /^День 8(?: •)?$/ }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator("#program-week-1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("check-in explains the meaning and direction of each scale", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page.locator("#energy-help")).toContainText("в течение дня");
  await expect(page.locator("#difficulty-help")).toContainText(
    "задания сегодня",
  );
  await expect(page.locator("#mood-help")).toContainText("настроение за день");
  await expect(
    page.getByRole("combobox", { name: "Энергия", exact: true }),
  ).toHaveAttribute("aria-describedby", "energy-help");
});

test("recipe photography loads in the catalog and recipe details", async ({
  page,
  request,
}) => {
  for (let i = 1; i <= 24; i++) {
    const response = await request.get(`/images/recipes/recipe-${i}.webp`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
  await page.goto("/nutrition");
  await page.getByRole("textbox", { name: "Поиск" }).fill("Овсянка");
  const photo = page.getByRole("img", {
    name: "Овсянка с яблоком",
    exact: true,
  });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Подробнее", exact: true }).click();
  const detailPhoto = page
    .getByRole("dialog")
    .getByRole("img", { name: "Овсянка с яблоком", exact: true });
  await expect(detailPhoto).toBeVisible();
  await expect
    .poll(() =>
      detailPhoto.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("records, edits and removes optional body measurements", async ({
  page,
}) => {
  await page.goto("/progress");
  const card = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Замеры тела" }) });
  await card.getByLabel("Вес, кг").fill("72,5");
  await card.getByLabel("Талия, см").fill("81");
  await card.getByRole("button", { name: "Сохранить" }).click();
  const entry = card.locator("details");
  await entry.locator("summary").click();
  await expect(entry).toContainText("72,5");
  await entry.getByRole("button", { name: "Изменить замер" }).click();
  await card.getByLabel("Талия, см").fill("80");
  await card.getByRole("button", { name: "Сохранить" }).click();
  await expect(entry).toContainText("Талия, см · 80");
  await entry.getByRole("button", { name: "Удалить замер" }).click();
  await expect(entry).toHaveCount(0);
});
