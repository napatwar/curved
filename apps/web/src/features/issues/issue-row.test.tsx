import type { WorkflowState } from "@curved/zero";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { IssueRow, type IssueRowData } from "./issue-row";

const workspaceId = "00000000-0000-7000-8000-000000000001";
const teamId = "00000000-0000-7000-8000-000000000021";

function state(category: WorkflowState["category"]): WorkflowState {
  return {
    id: `01a1a796-94af-7420-9b34-22939000000${category.length}`,
    workspaceId,
    teamId,
    name: category,
    color: "#000000",
    category,
    position: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

const issue: IssueRowData = {
  id: "01a1a796-94af-7420-9b34-229390fd4fc9",
  workspaceId,
  teamId,
  number: 12,
  title: "Write tests",
  stateId: state("unstarted").id,
  priority: 0,
  assigneeId: null,
  creatorId: null,
  dueDate: null,
  parentId: null,
  sortOrder: "a0",
  archivedAt: null,
  deletedAt: null,
  createdAt: 0,
  updatedAt: 0,
  state: state("unstarted"),
  team: {
    id: teamId,
    workspaceId,
    key: "ENG",
    name: "Engineering",
    nextIssueNumber: 13,
    defaultStateId: state("unstarted").id,
    createdAt: 0,
    updatedAt: 0,
  },
};

describe("IssueRow", () => {
  it("shows the issue key and calls onToggleDone when Done is clicked", async () => {
    const onToggleDone = vi.fn<() => void>();
    const screen = await render(
      <ul>
        <IssueRow disabled={false} issue={issue} onToggleDone={onToggleDone} />
      </ul>,
    );

    await expect.element(screen.getByText("ENG-12")).toBeVisible();
    await screen.getByRole("button", { name: "Done" }).click();

    expect(onToggleDone).toHaveBeenCalledOnce();
  });

  it("offers Reopen for an issue in a completed state", async () => {
    const screen = await render(
      <ul>
        <IssueRow
          disabled={false}
          issue={{ ...issue, state: state("completed") }}
          onToggleDone={() => {}}
        />
      </ul>,
    );

    await expect.element(screen.getByRole("button", { name: "Reopen" })).toBeVisible();
  });

  it("shows a pending key until the server assigns the number", async () => {
    const screen = await render(
      <ul>
        <IssueRow disabled={false} issue={{ ...issue, number: 0 }} onToggleDone={() => {}} />
      </ul>,
    );

    await expect.element(screen.getByText("ENG-…")).toBeVisible();
  });
});
