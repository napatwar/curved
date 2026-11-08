import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const composeFile = new URL("../../deploy/docker-compose.yml", import.meta.url).pathname;

/** Whether the API logged a Zero query request that carried a cookie since `since`. */
function apiReceivedCookie(since: Date) {
  const output = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "logs",
      "curved",
      "--no-log-prefix",
      "--since",
      since.toISOString(),
    ],
    { encoding: "utf8" },
  );
  return output.split("\n").some((line) => {
    if (!line.startsWith("{")) {
      return false;
    }
    const entry: unknown = JSON.parse(line);
    return (
      typeof entry === "object" &&
      entry !== null &&
      "path" in entry &&
      entry.path === "/api/zero/query" &&
      "hasCookie" in entry &&
      entry.hasCookie === true
    );
  });
}

test("the web app syncs through /zero on its own origin", async ({ browser, baseURL }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  const socket = first.waitForEvent("websocket");
  const title = `Production sync check ${Date.now()}`;

  await first.goto("/");
  await second.goto("/");

  const origin = new URL(baseURL ?? "http://localhost");
  const socketUrl = new URL((await socket).url());
  expect(socketUrl.host).toBe(origin.host);
  expect(socketUrl.pathname).toMatch(/^\/zero\//);

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

// ADR 0005 and 0008: the session cookie is host-only with SameSite=Lax. The
// browser sends it to zero-cache under /zero, and zero-cache forwards it to
// the API. The API logs whether a cookie arrived, never its value.
test("a host-only Lax cookie reaches the API through zero-cache", async ({ browser, baseURL }) => {
  const since = new Date(Date.now() - 1000);
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "curved_e2e",
      value: String(Date.now()),
      url: baseURL ?? "http://localhost",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("connected")).toBeVisible();

  await expect.poll(() => apiReceivedCookie(since), { timeout: 10_000 }).toBe(true);
});
