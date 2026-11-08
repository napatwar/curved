import { defineConfig, devices } from "@playwright/test";

// Postgres and zero-cache must already be running: `pnpm infra:up`.
// WEB_PORT and API_PORT let a second checkout run its own stack.
const webPort = process.env.WEB_PORT ?? "5173";
const apiPort = process.env.API_PORT ?? "3000";

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
    baseURL: `http://localhost:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @curved/api dev",
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm --filter @curved/web dev --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
