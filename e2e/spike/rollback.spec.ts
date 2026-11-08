import { expect, test } from "@playwright/test";

import { observePage, recordResult, sql, waitForRows, WORKSPACE_ID } from "./support";

const TITLE = `Spike rollback check ${Date.now()}`;
let issueId = "";

// A trigger stands in for a rule that only the server enforces, such as a
// permission check. zero-cache ignores CREATE TRIGGER, so it is not a schema
// change for Zero.
test.beforeAll(async () => {
  const now = new Date();
  const [row] = await sql<{ id: string }>(
    `insert into issue (id, workspace_id, title, status, created_at, updated_at)
     values (uuidv7(), $1, $2, 'todo', $3, $3) returning id`,
    [WORKSPACE_ID, TITLE, now],
  );
  issueId = row?.id ?? "";
  await sql(`create or replace function spike_reject_update() returns trigger
    language plpgsql as $$ begin raise exception 'This issue is locked'; end $$`);
  await sql(`create trigger spike_reject_update before update on issue for each row
    when (old.id = '${issueId}') execute function spike_reject_update()`);
});

test.afterAll(async () => {
  await sql("drop trigger if exists spike_reject_update on issue");
  await sql("drop function if exists spike_reject_update");
  await sql("delete from issue where id = $1", [issueId]);
});

test("a rejected mutation rolls back and shows the error", async ({ page }) => {
  await observePage(page);
  await page.goto("/");
  await waitForRows(page);
  const row = page.locator("main ul > li").filter({ hasText: TITLE });
  await expect(row.locator("button")).toHaveText("Done");
  await page.evaluate(() => {
    const target = [...document.querySelectorAll("main ul > li")].find((li) =>
      li.textContent?.includes("Spike rollback check"),
    );
    if (!target) {
      throw new Error("Row not found");
    }
    window.spikeTimings.rowChanges = [];
    new MutationObserver(() => {
      const text = target.querySelector("button")?.textContent ?? "";
      if (text !== window.spikeTimings.rowChanges.at(-1)?.text) {
        window.spikeTimings.rowChanges.push({ text, at: Date.now() });
      }
    }).observe(target, { childList: true, subtree: true, characterData: true });
    new MutationObserver((_, observer) => {
      if (document.querySelector("[role=alert]")) {
        window.spikeTimings.alertAt = Date.now();
        observer.disconnect();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  const clickedAt = await page.evaluate(() => {
    const at = Date.now();
    [...document.querySelectorAll("main ul > li")]
      .find((li) => li.textContent?.includes("Spike rollback check"))
      ?.querySelector("button")
      ?.click();
    return at;
  });
  // Role and text locators scan all 40,000 elements on the page's main thread,
  // which delays Zero's own work, so wait with a cheap check instead.
  await page.waitForFunction(() => window.spikeTimings.alertAt !== undefined);
  await expect(page.locator("[role=alert]")).toContainText("Change not saved");
  await expect(row.locator("button")).toHaveText("Done");

  const changes = await page.evaluate(() => window.spikeTimings.rowChanges);
  const [saved] = await sql<{ status: string }>("select status from issue where id = $1", [
    issueId,
  ]);
  const status = saved?.status;
  const result = {
    buttonTexts: changes.map((change) => change.text),
    optimisticMs: (changes[0]?.at ?? 0) - clickedAt,
    rolledBackMs: (changes.at(-1)?.at ?? 0) - clickedAt,
    errorShownMs: (await page.evaluate(() => window.spikeTimings.alertAt ?? 0)) - clickedAt,
    error: await page.locator("[role=alert]").textContent(),
    statusInPostgres: status,
  };
  recordResult("rollback", result);
  expect(result.buttonTexts).toEqual(["Reopen", "Done"]);
  expect(status).toBe("todo");
});
