import { defineConfig, devices } from "@playwright/test";
const remoteUrl = process.env.EVOLUTION_TEST_BASE_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: process.env.EVOLUTION_E2E_CONNECTED === "1" ? 1 : undefined,

  use: {
    baseURL: remoteUrl ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: remoteUrl
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: false,
        timeout: 60000,
      },
});
