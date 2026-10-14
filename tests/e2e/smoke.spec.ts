import { test, expect } from "@playwright/test";
test.skip(
  process.env.EVOLUTION_E2E_MODE === "demo",
  "Smoke checks target the connected production build.",
);
test("public auth pages and anonymous API isolation", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Маленькие шаги. Заметные перемены." }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(
    page.getByRole("textbox", { name: "Электронная почта" }),
  ).toBeVisible();
  const response = await request.get("/api/v1/me");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/today");
  await expect(page).toHaveURL(/login/);
});
test("health response is private and contains no keys or user fields", async ({
  request,
}) => {
  const response = await request.get("/api/v1/health");
  expect([200, 503]).toContain(response.status());
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(typeof body.data.ready).toBe("boolean");
  expect(JSON.stringify(body)).not.toMatch(
    /sb_publishable_|sb_secret_|access_token|display_name/,
  );
});
test("notification settings and worker reject anonymous requests", async ({
  request,
}) => {
  expect((await request.get("/api/v1/notifications/settings")).status()).toBe(
    401,
  );
  expect((await request.post("/api/v1/notifications/dispatch")).status()).toBe(
    401,
  );
});
test("auth uses HTTPS callback and controls have no permanent focus frames", async ({
  page,
}) => {
  const redirects: string[] = [];
  await page.route(/\/auth\/v1\/(signup|resend)/, async (route) => {
    redirects.push(
      new URL(route.request().url()).searchParams.get("redirect_to") ?? "",
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        email: "test@example.com",
        identities: [],
      }),
    });
  });
  await page.goto("/signup");
  const email = page.getByLabel("Электронная почта");
  await email.fill("test@example.com");
  await page.getByLabel("Пароль").fill("evolution-test-password");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect.poll(() => redirects.length).toBe(1);
  expect(redirects[0]).toMatch(/^https:\/\/.+\/auth\/callback$/);
  expect(redirects[0]).not.toContain("localhost");
  await page
    .getByRole("button", { name: "Отправить подтверждение повторно" })
    .click();
  await expect.poll(() => redirects.length).toBe(2);
  expect(redirects[1]).toBe(redirects[0]);
  await page.locator("h1").click();
  expect(await email.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "none",
  );
  expect(
    await page
      .getByRole("link", { name: "Evolution", exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("none");
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Пароль")).toHaveCSS("outline-style", "solid");
});
