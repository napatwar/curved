import { Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("shows a title, a hint and an action", async () => {
    const screen = await render(
      <EmptyState action={<Button>New issue</Button>} icon={Inbox} title="No issues">
        Create the first issue.
      </EmptyState>,
    );

    await expect.element(screen.getByRole("heading", { name: "No issues" })).toBeVisible();
    await expect.element(screen.getByText("Create the first issue.")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "New issue" })).toBeVisible();
  });
});
