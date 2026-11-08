import { expect, test } from "@playwright/test";

import {
  observePage,
  recordResult,
  summarize,
  waitForRows,
  watchFirstRow,
  watchNewestIssue,
} from "./support";

const CHANGES = 20;

test("a state change shows locally at once and in another browser within 1 second", async ({
  browser,
}) => {
  const [first, second] = await Promise.all(
    [0, 1].map(async () => {
      const page = await (await browser.newContext()).newPage();
      await observePage(page);
      await page.goto("/");
      await waitForRows(page);
      return page;
    }),
  );
  if (!first || !second) {
    throw new Error("Pages did not open");
  }
  // Both lists sort by creation time, so the first row is the same issue.
  await watchFirstRow(first);
  await watchFirstRow(second);
  await watchNewestIssue(first);
  await watchNewestIssue(second);

  // Through the UI: click in one browser, then wait for the row's button
  // text to change in both. Every change re-renders all rows in React.
  const uiLocal: number[] = [];
  const uiRemote: number[] = [];
  // Through Zero only: the time until a query listener sees the change.
  const zeroLocal: number[] = [];
  const zeroRemote: number[] = [];
  for (let change = 0; change < CHANGES; change++) {
    const clickedAt = await first.evaluate(() => {
      const at = Date.now();
      document.querySelector<HTMLButtonElement>("main ul > li button")?.click();
      return at;
    });
    await expect
      .poll(() => second.evaluate(() => window.spikeTimings.rowChanges.length))
      .toBe(change + 1);
    await expect
      .poll(() => second.evaluate(() => window.spikeTimings.newestChanges.length))
      .toBe(change + 1);
    const [firstUi, firstZero] = await first.evaluate(() => [
      window.spikeTimings.rowChanges.at(-1)?.at ?? 0,
      window.spikeTimings.newestChanges.at(-1)?.at ?? 0,
    ]);
    const [secondUi, secondZero] = await second.evaluate(() => [
      window.spikeTimings.rowChanges.at(-1)?.at ?? 0,
      window.spikeTimings.newestChanges.at(-1)?.at ?? 0,
    ]);
    uiLocal.push((firstUi ?? 0) - clickedAt);
    uiRemote.push((secondUi ?? 0) - clickedAt);
    zeroLocal.push((firstZero ?? 0) - clickedAt);
    zeroRemote.push((secondZero ?? 0) - clickedAt);
    await first.waitForTimeout(250);
  }

  const result = {
    uiLocalMs: summarize(uiLocal),
    uiOtherBrowserMs: summarize(uiRemote),
    zeroLocalMs: summarize(zeroLocal),
    zeroOtherBrowserMs: summarize(zeroRemote),
  };
  recordResult("status-sync", result);
  expect.soft(result.zeroLocalMs.p95).toBeLessThan(100);
  expect.soft(result.uiOtherBrowserMs.p95).toBeLessThan(1000);
});
