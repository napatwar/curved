import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the production Compose stack in deploy/, through
// Caddy on one origin. Start it first:
//
//   cd deploy && cp .env.example .env   # fill in the secrets
//   docker compose up -d --build --wait
//   pnpm test:e2e:prod
//
// CURVED_URL overrides the address, such as http://localhost:8080.
export default defineConfig({
  testDir: "./e2e/prod",
  // Signs up the first user (the instance admin) and creates a workspace.
  globalSetup: "./e2e/prod/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.CURVED_URL ?? "http://localhost",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
