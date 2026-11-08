import { createFileRoute, Navigate } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { useTeams } from "@/features/teams";
import { useWorkspace } from "@/features/workspaces";

export const Route = createFileRoute("/_app/$workspaceSlug/")({
  component: WorkspaceHome,
});

/** Opens the first team's issues. */
function WorkspaceHome() {
  const workspace = useWorkspace();
  const { teams, complete } = useTeams(workspace.id);
  const [team] = teams;

  if (team) {
    return (
      <Navigate
        params={{ workspaceSlug: workspace.slug, teamKey: team.key }}
        replace
        to="/$workspaceSlug/team/$teamKey/issues"
      />
    );
  }
  if (!complete) {
    return <LoadingState />;
  }
  return (
    <>
      <PageHeader title={workspace.name} />
      <PageBody>
        <EmptyState title="No teams">
          Every workspace needs a team. Create one in Settings.
        </EmptyState>
      </PageBody>
    </>
  );
}
