import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("an issue syncs between two browsers", async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  const title = `Sync check ${Date.now()}`;

  await signIn(first);
  await signIn(second);

  await first.getByLabel("Issue title").fill(title);
  await first.getByRole("button", { name: "Add" }).click();

  const secondRow = second.getByRole("listitem").filter({ hasText: title });
  await expect(secondRow).toBeVisible();

  await secondRow.getByRole("button", { name: "Done" }).click();

  const firstRow = first.getByRole("listitem").filter({ hasText: title });
  await expect(firstRow.getByRole("button", { name: "Reopen" })).toBeVisible();
});

test("two browsers that create issues at once get different numbers", async ({ browser }) => {
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const page = await (await browser.newContext()).newPage();
      await signIn(page);
      return page;
    }),
  );
  const stamp = Date.now();
  const titles = pages.map((_, index) => `Concurrent ${stamp} ${index}`);
  await Promise.all(
    pages.map((page, index) => page.getByLabel("Issue title").fill(titles[index] ?? "")),
  );

  await Promise.all(pages.map((page) => page.getByRole("button", { name: "Add" }).click()));

  // The server assigns each number, so both browsers show the same keys.
  const keysByPage = await Promise.all(
    pages.map(async (page) =>
      Promise.all(
        titles.map(async (title) => {
          const row = page.getByRole("listitem").filter({ hasText: title });
          await expect(row).toContainText(/[A-Z][A-Z0-9]*-\d+/);
          return (await row.textContent())?.match(/[A-Z][A-Z0-9]*-\d+/)?.[0];
        }),
      ),
    ),
  );
  const [firstKeys, secondKeys] = keysByPage;
  expect(new Set(firstKeys).size).toBe(2);
  expect(secondKeys).toEqual(firstKeys);
});
