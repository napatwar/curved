import type { Issue, Team, WorkflowState } from "@curved/zero";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

import { issueKey } from "./issue-key";

export function IssueRow({
  disabled,
  issue,
  team,
  state,
  onToggleDone,
}: {
  disabled: boolean;
  issue: Issue;
  team: Team | undefined;
  state: WorkflowState | undefined;
  onToggleDone: () => void;
}) {
  const isDone = state?.category === "completed";

  return (
    <li className="flex h-9 items-center justify-between gap-4 px-4 hover:bg-muted/50">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {issueKey(team?.key, issue.number)}
        </span>
        <span className={cn("truncate", isDone && "text-muted-foreground line-through")}>
          {issue.title}
        </span>
      </span>
      <Button disabled={disabled} onClick={onToggleDone} size="sm" variant="outline">
        {isDone ? "Reopen" : "Done"}
      </Button>
    </li>
  );
}
