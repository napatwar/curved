import { expect, test } from "@playwright/test";

import {
  observePage,
  recordResult,
  signIn,
  sql,
  summarize,
  waitForRows,
  WORKSPACE_ID,
} from "./support";

// Decision record 0006 asks for the time to open an issue once descriptions
// exist. Seed with `pnpm db:seed:spike`, which writes about 2KB of Markdown
// per description. The issue list syncs every issue but no description, so
// opening an issue waits for `issues.byId` from the server.

const RUNS = 20;

type OpenTiming = { firstRowMs: number; completeMs: number; descriptionBytes: number };

test("opening an issue loads its description quickly", async ({ page }) => {
  await observePage(page);
  await signIn(page);
  await waitForRows(page);

  const issues = await sql<{ id: string }>(
    "select id from issue where workspace_id = $1 order by random() limit $2",
    [WORKSPACE_ID, RUNS],
  );

  const open = (id: string) =>
    page.evaluate(
      async (issueId) =>
        new Promise<OpenTiming>((resolve, reject) => {
          const handle = window.curvedZero;
          if (!handle) {
            reject(new Error("The Zero test hook is missing"));
            return;
          }
          const start = performance.now();
          let firstRowMs = -1;
          const view = handle.zero.materialize(handle.queries.issues.byId({ id: issueId }));
          view.addListener((data, resultType) => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            const row = data as unknown as { description?: { body: string } } | undefined;
            if (firstRowMs < 0 && row?.description) {
              firstRowMs = performance.now() - start;
            }
            if (resultType === "complete") {
              const body = row?.description?.body ?? "";
              resolve({
                firstRowMs,
                completeMs: performance.now() - start,
                descriptionBytes: new TextEncoder().encode(body).length,
              });
              view.destroy();
            }
          });
        }),
      id,
    );

  const cold: OpenTiming[] = [];
  for (const { id } of issues) {
    cold.push(await open(id));
  }
  // The same issues again, while zero-cache still has the queries cached.
  const warm: OpenTiming[] = [];
  for (const { id } of issues.slice(0, 5)) {
    warm.push(await open(id));
  }

  const result = {
    descriptionBytes: summarize(cold.map((run) => run.descriptionBytes)),
    coldCompleteMs: summarize(cold.map((run) => run.completeMs)),
    coldDescriptionMs: summarize(cold.map((run) => run.firstRowMs)),
    reopenCompleteMs: summarize(warm.map((run) => run.completeMs)),
  };
  recordResult("open-issue", result);
  expect(result.descriptionBytes.min).toBeGreaterThan(1500);
  expect.soft(result.coldCompleteMs.p95).toBeLessThan(500);
});
