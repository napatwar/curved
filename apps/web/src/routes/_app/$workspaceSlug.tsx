import { queries } from "@curved/zero";
import { useConnectionState, useQuery } from "@rocicorp/zero/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { SignOutButton } from "@/features/auth";
import { IssueList } from "@/features/issues";
import { WorkspacePicker, writeLastWorkspace } from "@/features/workspaces";

export const Route = createFileRoute("/_app/$workspaceSlug")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { workspaceSlug } = Route.useParams();
  const { session } = Route.useRouteContext();
  const connection = useConnectionState();
  const [workspaces, result] = useQuery(queries.workspaces.mine());
  const current = workspaces.find((workspace) => workspace.slug === workspaceSlug);

  useEffect(() => {
    if (current) {
      writeLastWorkspace(current.slug);
    }
  }, [current]);

  if (!current) {
    if (result.type !== "complete") {
      return null;
    }
    return (
      <AuthLayout title="Workspace not found">
        <p>This workspace does not exist, or you are not a member.</p>
        <Link className="underline" to="/">
          Go to your workspaces
        </Link>
      </AuthLayout>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <WorkspacePicker current={current} workspaces={workspaces} />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{connection.name}</span>
          <span>{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>
      <IssueList key={current.id} workspaceId={current.id} />
    </main>
  );
}
