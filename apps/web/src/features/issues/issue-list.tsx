import { mutators, queries } from "@curved/zero";
import { useConnectionState, useQuery, useZero } from "@rocicorp/zero/react";
import { v7 as uuidv7 } from "uuid";

import { useCanWrite } from "@/hooks/use-can-write";

import { CreateIssueForm } from "./create-issue-form";
import { IssueRow } from "./issue-row";

export function IssueList({ workspaceId }: { workspaceId: string }) {
  const zero = useZero();
  const connection = useConnectionState();
  const canWrite = useCanWrite();
  const [issues] = useQuery(queries.issues.byWorkspace({ workspaceId }));

  return (
    <>
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Curved</h1>
        <span className="text-sm text-muted-foreground">{connection.name}</span>
      </header>

      <CreateIssueForm
        disabled={!canWrite}
        onCreate={(title) =>
          zero.mutate(mutators.issues.create({ id: uuidv7(), workspaceId, title }))
        }
      />

      <ul className="divide-y rounded-lg border">
        {issues.map((issue) => (
          <IssueRow
            disabled={!canWrite}
            issue={issue}
            key={issue.id}
            onToggleStatus={() =>
              zero.mutate(
                mutators.issues.setStatus({
                  id: issue.id,
                  status: issue.status === "done" ? "todo" : "done",
                }),
              )
            }
          />
        ))}
      </ul>
    </>
  );
}
