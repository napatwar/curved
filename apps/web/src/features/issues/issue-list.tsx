import { mutators, queries } from "@curved/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { ListTodo } from "lucide-react";
import { useMemo, useState } from "react";
import { v7 as uuidv7 } from "uuid";

import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import type { TeamWithStates } from "@/features/teams";
import { useCanWrite } from "@/hooks/use-can-write";

import { CreateIssueForm } from "./create-issue-form";
import { IssueRow } from "./issue-row";

/**
 * A team's active issues. A stand-in until the issue list task replaces it
 * with a virtualized list (decision record 0004).
 */
export function IssueList({ workspaceId, team }: { workspaceId: string; team: TeamWithStates }) {
  const zero = useZero();
  const canWrite = useCanWrite();
  const [issues, result] = useQuery(queries.issues.byTeam({ workspaceId, teamId: team.id }));
  const [error, setError] = useState<string | null>(null);
  // List queries return plain issue rows; their states come from the team.
  const statesById = useMemo(
    () => new Map(team.states.map((state) => [state.id, state])),
    [team.states],
  );

  // Zero has already applied the change locally. When the server rejects it
  // (an "app" error), Zero rolls the change back and this shows why. A "zero"
  // error means the connection was lost: the change stays queued and is sent
  // after reconnecting, so it is not reported as lost.
  async function mutate(request: Parameters<typeof zero.mutate>[0]) {
    setError(null);
    const response = await zero.mutate(request).server;
    if (response.type === "error" && response.error.type === "app") {
      setError(`Change not saved: ${response.error.message}`);
    }
  }

  // Done moves an issue to the team's first completed state, and Reopen to
  // the team's default state. App logic uses the category, never the name.
  function toggleDone(issue: (typeof issues)[number]) {
    const stateId =
      statesById.get(issue.stateId)?.category === "completed"
        ? team.defaultStateId
        : team.states.find((state) => state.category === "completed")?.id;
    if (stateId) {
      void mutate(mutators.issues.update({ id: issue.id, stateId }));
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <CreateIssueForm
          disabled={!canWrite}
          onCreate={(title) => {
            void mutate(
              mutators.issues.create({ id: uuidv7(), workspaceId, teamId: team.id, title }),
            );
          }}
        />
        {error && (
          <p className="mt-2 text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {issues.length > 0 ? (
        <ul aria-label="Issues" className="divide-y border-b">
          {issues.map((issue) => (
            <IssueRow
              disabled={!canWrite}
              issue={issue}
              key={issue.id}
              onToggleDone={() => toggleDone(issue)}
              state={statesById.get(issue.stateId)}
              team={team}
            />
          ))}
        </ul>
      ) : result.type === "complete" ? (
        <EmptyState icon={ListTodo} title="No issues">
          Add the first issue for {team.name} above.
        </EmptyState>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
