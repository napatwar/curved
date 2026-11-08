import { expect, test } from "@playwright/test";

import {
  connectionLabel,
  observePage,
  recordResult,
  sql,
  waitForRows,
  watchFirstRow,
  zeroCacheLogs,
} from "./support";

// Migrations that run while zero-cache and a client are connected. Each one is
// undone afterwards, so the database matches the Drizzle migrations again.
const changes = [
  { name: "add nullable column", ddl: "alter table issue add column spike_note text" },
  { name: "drop column", ddl: "alter table issue drop column spike_note" },
  {
    name: "change column type (table rewrite)",
    ddl: "alter table issue alter column title type varchar(300)",
  },
  { name: "change column type back", ddl: "alter table issue alter column title type text" },
  { name: "add index", ddl: "create index spike_issue_title_idx on issue (title)" },
  { name: "drop index", ddl: "drop index spike_issue_title_idx" },
  {
    name: "add then drop a column in two quick statements",
    ddl: "alter table issue add column spike_note text; alter table issue drop column spike_note",
  },
];

test.afterAll(async () => {
  await sql("alter table issue drop column if exists spike_note");
  await sql("alter table issue alter column title type text");
  await sql("drop index if exists spike_issue_title_idx");
});

test("schema changes apply without a full reset", async ({ page }) => {
  await observePage(page);
  await page.goto("/");
  await waitForRows(page);
  await page.evaluate(() => {
    window.spikeTimings.loadMarker = true;
  });
  await watchFirstRow(page);

  const results = [];
  for (const { name, ddl } of changes) {
    const startedAt = new Date();
    for (const statement of ddl.split(";")) {
      await sql(statement);
    }
    // zero-cache logs "Schema updated" once the replica has the change. Some
    // changes, such as a type change within the same Zero type, log nothing.
    let updatedAt: number | undefined;
    await expect
      .poll(
        () => {
          updatedAt = zeroCacheLogs(startedAt).find((line) =>
            line.text.includes("Schema updated"),
          )?.at;
          return updatedAt !== undefined;
        },
        { timeout: 15_000 },
      )
      .toBe(true)
      .catch(() => undefined);
    // Let the client reconnect if zero-cache dropped it, then check a write.
    await connectionLabel(page, "connected", 60_000);
    const before = await page.evaluate(() => window.spikeTimings.rowChanges.length);
    await page.locator("main ul > li button").first().click();
    await expect
      .poll(() => page.evaluate(() => window.spikeTimings.rowChanges.length))
      .toBeGreaterThan(before);

    const logs = zeroCacheLogs(startedAt).map((line) => line.text);
    const connection = await page.evaluate(() => window.spikeTimings.connection);
    results.push({
      name,
      replicaUpdatedMs: updatedAt === undefined ? null : updatedAt - startedAt.getTime(),
      backfill: logs.some((line) => line.includes("finished backfilling")),
      resetOrInitialSync: logs.filter((line) => /full reset|resync|initial.sync/i.test(line))
        .length,
      zeroCacheErrors: logs
        .filter((line) => line.includes('"level":"ERROR"'))
        .map((line) => /"message":"([^"]{0,120})/.exec(line)?.[1] ?? line.slice(0, 120)),
      clientReconnected: connection.some(
        (state) => state.at >= startedAt.getTime() && state.name !== "connected",
      ),
      pageReloaded: !(await page.evaluate(() => window.spikeTimings.loadMarker === true)),
    });
    await page.waitForTimeout(2000);
  }

  recordResult("schema-change", results);
  for (const result of results) {
    expect.soft(result.resetOrInitialSync, result.name).toBe(0);
    expect.soft(result.pageReloaded, result.name).toBe(false);
  }
});
