import { expect, test } from "@playwright/test";

test("an issue syncs between two browsers", async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  const title = `Sync check ${Date.now()}`;

  await first.goto("/");
  await second.goto("/");
  await expect(first.getByText("connected")).toBeVisible();
  await expect(second.getByText("connected")).toBeVisible();

  await first.getByLabel("Issue title").fill(title);
  await first.getByRole("button", { name: "Add" }).click();

  const secondRow = second.getByRole("listitem").filter({ hasText: title });
  await expect(secondRow).toBeVisible();

  await secondRow.getByRole("button", { name: "Done" }).click();

  const firstRow = first.getByRole("listitem").filter({ hasText: title });
  await expect(firstRow.getByRole("button", { name: "Reopen" })).toBeVisible();
});
