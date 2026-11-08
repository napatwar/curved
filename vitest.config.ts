import { defineConfig } from "vitest/config";

const nodeSources = ["apps/api/src/**", "packages/*/src/**"];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: nodeSources.map((dir) => `${dir}/*.test.ts`),
          exclude: ["**/*.integration.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: nodeSources.map((dir) => `${dir}/*.integration.test.ts`),
          globalSetup: ["./test/global-setup.ts"],
          // Tests share one database, so run files one at a time.
          fileParallelism: false,
        },
      },
      "./apps/web/vitest.config.ts",
    ],
  },
});
