import { Link } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { renderWithRouter } from "@/testing/render-with-router";

import { AppShell, PageBody, PageHeader } from "./app-shell";

function Shell() {
  return (
    <AppShell
      sidebar={
        <nav aria-label="Workspace">
          <Link to="/$workspaceSlug/trash" params={{ workspaceSlug: "acme" }}>
            Trash
          </Link>
        </nav>
      }
    >
      <PageHeader title="Issues" />
      <PageBody>Content</PageBody>
    </AppShell>
  );
}

describe("AppShell", () => {
  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  it("shows the sidebar beside the page on a wide window", async () => {
    await page.viewport(1280, 720);
    const { screen } = await renderWithRouter(Shell);

    await expect.element(screen.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "Issues" })).toBeVisible();
    // The menu button exists only for narrow windows.
    expect(screen.getByRole("button", { name: "Open sidebar" }).elements()).toHaveLength(0);
  });

  it("opens the sidebar as a drawer on a narrow window and closes it on navigation", async () => {
    await page.viewport(390, 800);
    const { screen, router } = await renderWithRouter(Shell, "/acme/issues");

    await expect
      .element(screen.getByRole("navigation", { name: "Workspace" }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Open sidebar" }).click();
    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    await expect.element(drawer).toBeVisible();

    await drawer.getByRole("link", { name: "Trash" }).click();

    expect(router.state.location.pathname).toBe("/acme/trash");
    await expect.element(drawer).not.toBeInTheDocument();
  });
});
