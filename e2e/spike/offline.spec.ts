import { expect, test } from "@playwright/test";

import { connectionLabel, observePage, recordResult, signIn, sql, waitForRows } from "./support";

const OFFLINE_MS = 75_000;

test("offline for more than a minute becomes read-only and keeps queued work", async ({
  browser,
}) => {
  // The second browser checks that the queued write arrives after reconnecting.
  const other = await (await browser.newContext()).newPage();
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const p of [other, page]) {
    await observePage(p);
    await signIn(p);
    await waitForRows(p);
  }
  await page.bringToFront();
  const rowsBefore = await page.locator("main ul > li").count();
  const title = `Written offline ${Date.now()}`;

  const offlineAt = Date.now();
  await context.setOffline(true);

  // Zero queues writes while it is still trying to reconnect.
  await connectionLabel(page, "connecting");
  await page.locator("main form input").fill(title);
  await page.locator("main form button").click();
  await expect(page.locator("main ul > li").first()).toContainText(title);
  const queuedAt = Date.now();

  // After the disconnect timeout, the UI must stop accepting writes.
  await connectionLabel(page, "disconnected", 120_000);
  await expect(page.locator("main form input")).toBeDisabled();
  await expect(page.locator("main ul > li button").first()).toBeDisabled();
  const readOnlyRows = await page.locator("main ul > li").count();
  const alert = page.locator("[role=alert]");
  const errorWhileReadOnly = (await alert.count()) > 0 ? await alert.textContent() : null;

  await page.waitForTimeout(Math.max(0, OFFLINE_MS - (Date.now() - offlineAt)));
  const onlineAt = Date.now();
  await context.setOffline(false);
  await connectionLabel(page, "connected", 60_000);
  const reconnectedAt = Date.now();

  await expect(other.locator("main ul > li").first()).toContainText(title);
  const saved = await sql("select id from issue where title = $1", [title]);

  const connection = await page.evaluate(() => window.spikeTimings.connection);
  const result = {
    offlineMs: onlineAt - offlineAt,
    connectionStates: connection
      .filter((state) => state.at >= offlineAt)
      .map((state) => ({ name: state.name, afterOfflineMs: state.at - offlineAt })),
    queuedWriteAfterOfflineMs: queuedAt - offlineAt,
    rowsBefore,
    rowsWhileReadOnly: readOnlyRows,
    reconnectMs: reconnectedAt - onlineAt,
    queuedWriteSavedInPostgres: saved.length === 1,
    errorWhileReadOnly,
    queuedWriteStillShownAfterReconnect: await page
      .locator("main ul > li")
      .first()
      .textContent()
      .then((text) => text?.includes(title) ?? false),
  };
  recordResult("offline", result);
  expect(result.queuedWriteSavedInPostgres).toBe(true);
  expect(result.errorWhileReadOnly).toBeNull();
});
