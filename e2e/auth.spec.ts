import { DEV_TEAM_KEY, DEV_USER_EMAIL, DEV_WORKSPACE_SLUG } from "@curved/db/dev";
import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("a visitor without a session is sent to sign in", async ({ page }) => {
  await page.goto(`/${DEV_WORKSPACE_SLUG}`);

  await expect(page).toHaveURL(/\/sign-in\?redirect=/);
  await expect(page.getByRole("heading", { name: "Sign in to Curved" })).toBeVisible();
});

test("a wrong password shows an error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(DEV_USER_EMAIL);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
});

test("the dev user signs in, sees their workspace and signs out", async ({ page }) => {
  await signIn(page);

  await expect(page).toHaveURL(new RegExp(`/${DEV_WORKSPACE_SLUG}/team/${DEV_TEAM_KEY}/issues$`));
  await expect(page.getByRole("button", { name: "Workspace menu, Curved" })).toBeVisible();
  await expect(page.getByText("Welcome to Curved")).toBeVisible();

  await page.getByRole("button", { name: "Workspace menu, Curved" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  // Signing out deletes Zero's local data and the session.
  await page.goto(`/${DEV_WORKSPACE_SLUG}`);
  await expect(page).toHaveURL(/\/sign-in\?redirect=/);
});
