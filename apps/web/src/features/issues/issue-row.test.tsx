import type { Issue } from "@curved/zero";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { IssueRow } from "./issue-row";

const issue: Issue = {
  id: "01a1a796-94af-7420-9b34-229390fd4fc9",
  workspaceId: "00000000-0000-7000-8000-000000000001",
  title: "Write tests",
  status: "todo",
  createdAt: 0,
  updatedAt: 0,
};

describe("IssueRow", () => {
  it("calls onToggleStatus when Done is clicked", async () => {
    const onToggleStatus = vi.fn<() => void>();
    const screen = await render(
      <ul>
        <IssueRow disabled={false} issue={issue} onToggleStatus={onToggleStatus} />
      </ul>,
    );

    await screen.getByRole("button", { name: "Done" }).click();

    expect(onToggleStatus).toHaveBeenCalledOnce();
  });

  it("offers Reopen for a done issue", async () => {
    const screen = await render(
      <ul>
        <IssueRow disabled={false} issue={{ ...issue, status: "done" }} onToggleStatus={() => {}} />
      </ul>,
    );

    await expect.element(screen.getByRole("button", { name: "Reopen" })).toBeVisible();
  });
});
