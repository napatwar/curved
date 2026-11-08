import { defineConfig, devices } from "@playwright/test";

// Measurements for the Zero spike in docs/decisions/0004-zero-spike-results.md.
// They take several minutes and change data, so `pnpm test:e2e` skips them.
// Run `pnpm infra:up` and `pnpm db:seed:spike` first, then `pnpm test:spike`.
// The web app is a production build, so load times exclude Vite's dev server.
export default defineConfig({
  testDir: "./e2e/spike",
  fullyParallel: false,
  workers: 1,
  timeout: 10 * 60_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @curved/api dev",
      url: "http://localhost:3000/health",
      reuseExistingServer: true,
    },
    {
      // The spike mode keeps the test hook from `use-expose-zero.ts`.
      command:
        "pnpm --filter @curved/web build --mode spike && pnpm --filter @curved/web preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
