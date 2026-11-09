import { queries, type Workspace } from "@curved/zero";
import { useQuery } from "@rocicorp/zero/react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell, PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { NotFoundPage } from "@/components/not-found-page";
import { AppSidebar, useNavigationShortcuts } from "@/features/navigation";
import { useTeams } from "@/features/teams";
import { WorkspaceProvider, writeLastWorkspace } from "@/features/workspaces";

export const Route = createFileRoute("/_app/$workspaceSlug")({
  component: WorkspaceLayout,
  // An unknown address inside a workspace keeps the sidebar.
  notFoundComponent: () => (
    <>
      <PageHeader title="Not found" />
      <PageBody>
        <EmptyState title="Page not found">This address does not lead to a page.</EmptyState>
      </PageBody>
    </>
  ),
});

function WorkspaceLayout() {
  const { workspaceSlug } = Route.useParams();
  const [workspaces, result] = useQuery(queries.workspaces.mine());
  const current = workspaces.find((workspace) => workspace.slug === workspaceSlug);

  useEffect(() => {
    if (current) {
      writeLastWorkspace(current.slug);
    }
  }, [current]);

  if (!current) {
    if (result.type !== "complete") {
      return <LoadingState />;
    }
    // A workspace the user cannot see looks the same as one that does not
    // exist, so the page does not reveal which workspaces exist.
    return (
      <NotFoundPage title="Workspace not found">
        This workspace does not exist, or you are not a member.
      </NotFoundPage>
    );
  }

  return <WorkspaceFrame workspace={current} workspaces={workspaces} />;
}

function WorkspaceFrame({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  workspaces: readonly Workspace[];
}) {
  const { teams } = useTeams(workspace.id);
  useNavigationShortcuts(
    workspace.slug,
    teams.map((team) => team.key),
  );

  return (
    <WorkspaceProvider workspace={workspace}>
      <AppShell
        sidebar={<AppSidebar teams={teams} workspace={workspace} workspaces={workspaces} />}
      >
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
