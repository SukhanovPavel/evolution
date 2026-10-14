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
