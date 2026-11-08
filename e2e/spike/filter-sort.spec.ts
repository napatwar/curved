import { expect, test } from "@playwright/test";

import { observePage, recordResult, sql, waitForRows, WORKSPACE_ID } from "./support";

const DAY_MS = 86_400_000;
const now = Date.now();

// Single filters, sorts and multi-condition filters on `issues.byFilter`.
const cases: { name: string; args: Record<string, unknown> }[] = [
  { name: "default sort, newest 100", args: {} },
  { name: "sort by updatedAt asc", args: { sort: "updatedAt", direction: "asc" } },
  { name: "sort by title asc", args: { sort: "title", direction: "asc" } },
  { name: "sort by status desc", args: { sort: "status" } },
  { name: "status todo", args: { statuses: ["todo"] } },
  { name: "title contains 'safari'", args: { titleContains: "safari" } },
  { name: "title contains Thai text", args: { titleContains: "ภาษาไทย" } },
  {
    name: "multi: 2 statuses, title, created and updated range, sort updatedAt",
    args: {
      statuses: ["todo", "in_progress"],
      titleContains: "fix",
      createdAfter: now - 365 * DAY_MS,
      updatedBefore: now - 30 * DAY_MS,
      sort: "updatedAt",
    },
  },
  { name: "comment contains 'websocket'", args: { commentContains: "websocket" } },
  {
    name: "multi: status, title and comment text",
    args: { statuses: ["in_progress"], titleContains: "search", commentContains: "regression" },
  },
  {
    name: "multi with no match: status, title, comment text",
    args: { statuses: ["done"], titleContains: "zzz", commentContains: "zzz" },
  },
  { name: "1000 rows, sort by title", args: { sort: "title", direction: "asc", limit: 1000 } },
];

test("filter and sort changes", async ({ page }) => {
  await observePage(page);
  await page.goto("/");
  await waitForRows(page);
  const [counted] = await sql<{ count: string }>(
    "select count(*) from issue where workspace_id = $1",
    [WORKSPACE_ID],
  );
  // The list query syncs every issue, so issue-only filters can run locally.
  await expect(page.locator("main ul > li")).toHaveCount(Number(counted?.count), {
    timeout: 60_000,
  });

  const results = [];
  for (const { name, args } of cases) {
    const runs = [];
    // The first run registers a new query with zero-cache. The second run
    // reuses it while its time-to-live keeps it on the server.
    for (let run = 0; run < 2; run++) {
      runs.push(
        await page.evaluate(
          async ({ filter, workspaceId }) => {
            const handle = window.curvedZero;
            if (!handle) {
              throw new Error("The Zero test hook is missing");
            }
            const start = performance.now();
            const view = handle.zero.materialize(
              handle.queries.issues.byFilter({ workspaceId, ...filter }),
            );
            return await new Promise<{
              localMs: number;
              localRows: number;
              completeMs: number;
              rows: number;
            }>((resolve) => {
              let local: { ms: number; rows: number } | undefined;
              view.addListener((data, resultType) => {
                const ms = performance.now() - start;
                local ??= { ms, rows: data.length };
                if (resultType === "complete") {
                  view.destroy();
                  resolve({
                    localMs: Math.round(local.ms * 10) / 10,
                    localRows: local.rows,
                    completeMs: Math.round(ms * 10) / 10,
                    rows: data.length,
                  });
                }
              });
            });
          },
          { filter: args, workspaceId: WORKSPACE_ID },
        ),
      );
    }
    results.push({ name, first: runs[0], repeat: runs[1] });
  }

  recordResult("filter-sort", results);
  for (const result of results) {
    // A local answer within 100 ms is not perceptible.
    expect.soft(result.first?.localMs, result.name).toBeLessThan(100);
  }
});
