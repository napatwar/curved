import { mutators, queries } from "@curved/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useState } from "react";
import { v7 as uuidv7 } from "uuid";

import { useCanWrite } from "@/hooks/use-can-write";

import { CreateIssueForm } from "./create-issue-form";
import { IssueRow } from "./issue-row";

export function IssueList({ workspaceId }: { workspaceId: string }) {
  const zero = useZero();
  const canWrite = useCanWrite();
  const [issues] = useQuery(queries.issues.byWorkspace({ workspaceId }));
  const [error, setError] = useState<string | null>(null);

  // Zero has already applied the change locally. When the server rejects it
  // (an "app" error), Zero rolls the change back and this shows why. A "zero"
  // error means the connection was lost: the change stays queued and is sent
  // after reconnecting, so it is not reported as lost.
  async function mutate(request: Parameters<typeof zero.mutate>[0]) {
    setError(null);
    const result = await zero.mutate(request).server;
    if (result.type === "error" && result.error.type === "app") {
      setError(`Change not saved: ${result.error.message}`);
    }
  }

  return (
    <>
      <h1 className="sr-only">Issues</h1>

      <CreateIssueForm
        disabled={!canWrite}
        onCreate={(title) =>
          void mutate(mutators.issues.create({ id: uuidv7(), workspaceId, title }))
        }
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {issues.map((issue) => (
          <IssueRow
            disabled={!canWrite}
            issue={issue}
            key={issue.id}
            onToggleStatus={() =>
              void mutate(
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
