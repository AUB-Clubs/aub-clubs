import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const e2eAuthSecret = process.env.E2E_AUTH_SECRET ?? "local-e2e-secret";
const e2eAuthUserId =
  process.env.E2E_AUTH_USER_ID ?? "00000000-0000-4000-8000-000000000001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      E2E_TEST_MODE: "true",
      E2E_AUTH_SECRET: e2eAuthSecret,
      E2E_AUTH_USER_ID: e2eAuthUserId,
    },
  },
});
