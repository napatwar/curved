import type { Issue, Team, WorkflowState } from "@curved/zero";

import { Button } from "@/components/ui/button";

import { issueKey } from "./issue-key";

export type IssueRowData = Issue & {
  readonly state?: WorkflowState | undefined;
  readonly team?: Team | undefined;
};

export function IssueRow({
  disabled,
  issue,
  onToggleDone,
}: {
  disabled: boolean;
  issue: IssueRowData;
  onToggleDone: () => void;
}) {
  const isDone = issue.state?.category === "completed";

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {issueKey(issue.team?.key, issue.number)}
        </span>
        <span className={isDone ? "text-muted-foreground line-through" : undefined}>
          {issue.title}
        </span>
      </span>
      <Button disabled={disabled} onClick={onToggleDone} size="sm" variant="outline">
        {isDone ? "Reopen" : "Done"}
      </Button>
    </li>
  );
}
