import { expect, test } from "@playwright/test";

import { observePage, recordResult, summarize, waitForRows } from "./support";

const RUNS = 5;

test("first load shows the issue list within 2 seconds", async ({ browser }) => {
  const cold: number[] = [];
  const warm: number[] = [];
  const domReady: number[] = [];
  let rows = 0;

  for (let run = 0; run < RUNS; run++) {
    // A new context has empty IndexedDB, so Zero starts with no local data.
    const context = await browser.newContext();
    const page = await context.newPage();
    await observePage(page);

    await page.goto("/");
    await waitForRows(page);
    cold.push(await page.evaluate(() => window.spikeTimings.firstRowMs ?? 0));
    domReady.push(
      await page.evaluate(() => {
        const [entry] = performance.getEntriesByType("navigation");
        return entry instanceof PerformanceNavigationTiming ? entry.domContentLoadedEventEnd : 0;
      }),
    );
    rows = await page.locator("main ul > li").count();

    // The second load reads the data Zero stored in IndexedDB.
    await page.reload();
    await waitForRows(page);
    warm.push(await page.evaluate(() => window.spikeTimings.firstRowMs ?? 0));

    await context.close();
  }

  const result = {
    renderedRows: rows,
    domContentLoadedMs: summarize(domReady),
    coldFirstRowMs: summarize(cold),
    warmFirstRowMs: summarize(warm),
  };
  recordResult("first-load", result);
  expect.soft(result.coldFirstRowMs.p50).toBeLessThan(2000);
});
