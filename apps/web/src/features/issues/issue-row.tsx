import type { Issue } from "@curved/zero";

import { Button } from "@/components/ui/button";

export function IssueRow({
  disabled,
  issue,
  onToggleStatus,
}: {
  disabled: boolean;
  issue: Issue;
  onToggleStatus: () => void;
}) {
  const isDone = issue.status === "done";

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <span className={isDone ? "text-muted-foreground line-through" : undefined}>
        {issue.title}
      </span>
      <Button disabled={disabled} onClick={onToggleStatus} size="sm" variant="outline">
        {isDone ? "Reopen" : "Done"}
      </Button>
    </li>
  );
}
