import type { Workspace } from "@curved/zero";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setThemePreference } from "@/lib/theme";
import { renderWithRouter } from "@/testing/render-with-router";

import { WorkspaceMenu } from "./workspace-menu";

vi.mock("@rocicorp/zero/react", () => ({
  useZero: () => ({ delete: async () => {} }),
}));

function workspace(slug: string, name: string): Workspace {
  return { id: `00000000-0000-7000-8000-${slug.padStart(12, "0")}`, name, slug, logo: null };
}

const acme = workspace("acme", "Acme");
const thai = workspace("thai", "เกมสนุก");

describe("WorkspaceMenu", () => {
  afterEach(() => {
    setThemePreference("system");
  });

  it("switches to another workspace", async () => {
    const { screen, router } = await renderWithRouter(
      () => <WorkspaceMenu current={acme} workspaces={[acme, thai]} />,
      "/acme/my-issues",
    );

    await screen.getByRole("button", { name: "Workspace menu, Acme" }).click();
    await screen.getByRole("menuitemradio", { name: "เกมสนุก" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/thai");
  });

  it("sets the theme on this device", async () => {
    const { screen } = await renderWithRouter(() => (
      <WorkspaceMenu current={acme} workspaces={[acme]} />
    ));

    await screen.getByRole("button", { name: "Workspace menu, Acme" }).click();
    await screen.getByRole("menuitem", { name: "Theme" }).click();
    await screen.getByRole("menuitemradio", { name: "Dark" }).click();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("curved:theme")).toBe("dark");
  });
});
