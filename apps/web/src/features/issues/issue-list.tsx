import { mutators, queries } from "@curved/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useState } from "react";
import { v7 as uuidv7 } from "uuid";

import { useCanWrite } from "@/hooks/use-can-write";

import { CreateIssueForm } from "./create-issue-form";
import { IssueRow, type IssueRowData } from "./issue-row";

export function IssueList({ workspaceId }: { workspaceId: string }) {
  const zero = useZero();
  const canWrite = useCanWrite();
  const [teams] = useQuery(queries.teams.byWorkspace({ workspaceId }));
  const [issues] = useQuery(queries.issues.byWorkspace({ workspaceId }));
  const [error, setError] = useState<string | null>(null);
  // Every workspace has at least one team. With one team, the UI hides teams
  // (decision record 0006), so new issues go to the first one.
  const [team] = teams;

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

  // Done moves an issue to its team's first completed state, and Reopen to
  // the team's default state. App logic uses the category, never the name.
  function toggleDone(issue: IssueRowData) {
    const issueTeam = teams.find((candidate) => candidate.id === issue.teamId);
    const stateId =
      issue.state?.category === "completed"
        ? issueTeam?.defaultStateId
        : issueTeam?.states.find((state) => state.category === "completed")?.id;
    if (stateId) {
      void mutate(mutators.issues.update({ id: issue.id, stateId }));
    }
  }

  return (
    <>
      <h1 className="sr-only">Issues</h1>

      <CreateIssueForm
        disabled={!canWrite || !team}
        onCreate={(title) => {
          if (team) {
            void mutate(
              mutators.issues.create({ id: uuidv7(), workspaceId, teamId: team.id, title }),
            );
          }
        }}
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
            onToggleDone={() => toggleDone(issue)}
          />
        ))}
      </ul>
    </>
  );
}
