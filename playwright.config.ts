import { defineConfig, devices } from "@playwright/test";

// Postgres and zero-cache must already be running: `pnpm infra:up`.
export default defineConfig({
  testDir: "./e2e",
  // The Zero spike measurements (`pnpm test:spike`) and the production stack
  // tests (`pnpm test:e2e:prod`) run on their own.
  testIgnore: ["spike/**", "prod/**"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @curved/api dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @curved/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
