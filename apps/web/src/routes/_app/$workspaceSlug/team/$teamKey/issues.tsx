import { createFileRoute } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";
import { IssueList } from "@/features/issues";
import { useTeam, useTeams } from "@/features/teams";
import { useWorkspace } from "@/features/workspaces";

export const Route = createFileRoute("/_app/$workspaceSlug/team/$teamKey/issues")({
  component: TeamIssuesPage,
});

function TeamIssuesPage() {
  const workspace = useWorkspace();
  const team = useTeam();
  const { teams } = useTeams(workspace.id);

  return (
    <>
      {/* With one team, teams stay out of sight (decision record 0006). */}
      <PageHeader title={teams.length > 1 ? `${team.name} · Issues` : "Issues"} />
      <PageBody>
        <IssueList key={team.id} team={team} workspaceId={workspace.id} />
      </PageBody>
    </>
  );
}
