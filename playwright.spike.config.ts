import { defineConfig, devices } from "@playwright/test";

// Measurements for the Zero spike in docs/decisions/0004-zero-spike-results.md.
// They take several minutes and change data, so `pnpm test:e2e` skips them.
// Run `pnpm infra:up` and `pnpm db:seed:spike` first, then `pnpm test:spike`.
// The web app is a production build, so load times exclude Vite's dev server.
// API_PORT and SPIKE_WEB_PORT let a second checkout run its own stack.
const apiPort = process.env.API_PORT ?? "3000";
const webPort = process.env.SPIKE_WEB_PORT ?? "4173";

export default defineConfig({
  testDir: "./e2e/spike",
  fullyParallel: false,
  workers: 1,
  timeout: 10 * 60_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @curved/api dev",
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: true,
    },
    {
      // The spike mode keeps the test hook from `use-expose-zero.ts`.
      command: `pnpm --filter @curved/web build --mode spike && pnpm --filter @curved/web preview --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
