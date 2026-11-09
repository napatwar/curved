import type { Team, Workspace } from "@curved/zero";
import { describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "@/testing/render-with-router";

import { AppSidebar } from "./app-sidebar";

vi.mock("@rocicorp/zero/react", () => ({
  useConnectionState: () => ({ name: "connected" }),
  useZero: () => ({ delete: async () => {} }),
}));

const workspace: Workspace = {
  id: "00000000-0000-7000-8000-000000000001",
  name: "Acme",
  slug: "acme",
  logo: null,
};

function team(key: string, name: string): Team {
  return {
    id: `00000000-0000-7000-8000-0000000000${key.length}${name.length}`,
    workspaceId: workspace.id,
    key,
    name,
    nextIssueNumber: 1,
    defaultStateId: "00000000-0000-7000-8000-000000000099",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("AppSidebar", () => {
  it("links one team's issues as Issues and hides teams", async () => {
    const { screen } = await renderWithRouter(
      () => (
        <AppSidebar
          teams={[team("ENG", "Engineering")]}
          workspace={workspace}
          workspaces={[workspace]}
        />
      ),
      "/acme/team/ENG/issues",
    );

    const issues = screen.getByRole("link", { name: "Issues", exact: true });
    await expect.element(issues).toHaveAttribute("href", "/acme/team/ENG/issues");
    await expect.element(issues).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Teams" }).elements()).toHaveLength(0);
  });

  it("lists teams when there are several", async () => {
    const { screen } = await renderWithRouter(
      () => (
        <AppSidebar
          teams={[team("DES", "ทีมออกแบบ"), team("ENG", "Engineering")]}
          workspace={workspace}
          workspaces={[workspace]}
        />
      ),
      "/acme/my-issues",
    );

    await expect.element(screen.getByRole("heading", { name: "Teams" })).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "ทีมออกแบบ" }))
      .toHaveAttribute("href", "/acme/team/DES/issues");
    await expect
      .element(screen.getByRole("link", { name: "My issues" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Issues", exact: true }).elements()).toHaveLength(0);
  });

  it("links the workspace pages", async () => {
    const { screen } = await renderWithRouter(() => (
      <AppSidebar teams={[]} workspace={workspace} workspaces={[workspace]} />
    ));

    for (const [name, href] of [
      ["Views", "/acme/views"],
      ["Archive", "/acme/archive"],
      ["Trash", "/acme/trash"],
      ["Settings", "/acme/settings"],
    ]) {
      await expect.element(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    await expect.element(screen.getByRole("status", { name: "Sync: Synced" })).toBeInTheDocument();
  });
});
