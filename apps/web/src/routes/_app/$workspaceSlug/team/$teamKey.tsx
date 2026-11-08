import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { findTeamByKey, TeamProvider, useTeams } from "@/features/teams";
import { useWorkspace } from "@/features/workspaces";

export const Route = createFileRoute("/_app/$workspaceSlug/team/$teamKey")({
  component: TeamLayout,
});

function TeamLayout() {
  const { teamKey } = Route.useParams();
  const workspace = useWorkspace();
  const { teams, complete } = useTeams(workspace.id);
  const team = findTeamByKey(teams, teamKey);

  if (!team) {
    if (!complete) {
      return <LoadingState />;
    }
    return (
      <>
        <PageHeader title="Team not found" />
        <PageBody>
          <EmptyState title="Team not found">
            No team in {workspace.name} has the key {teamKey}.
          </EmptyState>
        </PageBody>
      </>
    );
  }

  return (
    <TeamProvider team={team}>
      <Outlet />
    </TeamProvider>
  );
}
