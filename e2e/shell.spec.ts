import {
  DEV_TEAM_KEY,
  DEV_USER_EMAIL,
  DEV_USER_PASSWORD,
  DEV_WORKSPACE_SLUG,
} from "@curved/db/dev";
import { expect, test } from "@playwright/test";

import { authApi, signIn } from "./helpers";

const teamIssues = new RegExp(`/${DEV_WORKSPACE_SLUG}/team/${DEV_TEAM_KEY}/issues$`);

test("the sidebar and shortcuts move between workspace pages", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(teamIssues);
  const sidebar = page.getByRole("navigation", { name: "Workspace" });

  await sidebar.getByRole("link", { name: "My issues" }).click();
  await expect(page).toHaveURL(new RegExp(`/${DEV_WORKSPACE_SLUG}/my-issues$`));
  await expect(page.getByRole("heading", { name: "My issues", level: 1 })).toBeVisible();

  await sidebar.getByRole("link", { name: "Trash" }).click();
  await expect(page.getByRole("heading", { name: "Trash", level: 1 })).toBeVisible();

  // G, then I opens the team's issues, and the old issue list still works.
  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await expect(page).toHaveURL(teamIssues);
  await expect(page.getByText("Welcome to Curved")).toBeVisible();

  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});

test("unknown teams, pages and workspaces show not found", async ({ page }) => {
  await signIn(page);

  await page.goto(`/${DEV_WORKSPACE_SLUG}/team/NOPE/issues`);
  await expect(page.getByRole("heading", { name: "Team not found", level: 2 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();

  await page.goto(`/${DEV_WORKSPACE_SLUG}/no/such/page`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();

  await page.goto("/no-such-workspace");
  await expect(page.getByRole("heading", { name: "Workspace not found" })).toBeVisible();
});

test("the workspace menu switches workspaces, and / opens the last one", async ({ page }) => {
  const stamp = Date.now();
  const slug = `shell-${stamp}`;
  const name = `Shell ${stamp}`;
  await signIn(page);
  // The dev user is the instance admin, so they can create a workspace.
  const workspace = await authApi<{ id: string }>(page, "/organization/create", { name, slug });

  try {
    await page.getByRole("button", { name: "Workspace menu, Curved" }).click();
    await page.getByRole("menuitemradio", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/team/[A-Z0-9]+/issues$`));
    await expect(page.getByRole("button", { name: `Workspace menu, ${name}` })).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`/${slug}/team/[A-Z0-9]+/issues$`));

    await page.getByRole("button", { name: `Workspace menu, ${name}` }).click();
    await page.getByRole("menuitemradio", { name: "Curved" }).click();
    await expect(page).toHaveURL(teamIssues);
  } finally {
    await authApi(page, "/organization/delete", { organizationId: workspace.id });
  }
});

test("a narrow window opens the sidebar as a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  // signIn waits for the sync dot, which sits in the hidden sidebar here.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(DEV_USER_EMAIL);
  await page.getByLabel("Password").fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(teamIssues);

  await page.getByRole("button", { name: "Open sidebar" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await drawer.getByRole("link", { name: "Archive" }).click();

  await expect(page).toHaveURL(new RegExp(`/${DEV_WORKSPACE_SLUG}/archive$`));
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
});
