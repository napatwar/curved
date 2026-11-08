import { queries } from "@curved/zero";
import { useQuery } from "@rocicorp/zero/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { SignOutButton } from "@/features/auth";
import { CreateWorkspaceForm, readLastWorkspace } from "@/features/workspaces";

export const Route = createFileRoute("/_app/")({
  component: WorkspaceHome,
});

/** Opens the last workspace the user used, or their first one. */
function WorkspaceHome() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const [workspaces, result] = useQuery(queries.workspaces.mine());
  const lastSlug = readLastWorkspace();
  const target =
    workspaces.find((workspace) => workspace.slug === lastSlug)?.slug ?? workspaces[0]?.slug;

  useEffect(() => {
    if (target) {
      void navigate({ to: "/$workspaceSlug", params: { workspaceSlug: target }, replace: true });
    }
  }, [navigate, target]);

  if (target || result.type !== "complete") {
    return null;
  }

  if (session.user.role === "admin") {
    return (
      <AuthLayout title="Create a workspace">
        <CreateWorkspaceForm />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="No workspace yet">
      <p>Ask a workspace admin to invite you.</p>
      <SignOutButton />
    </AuthLayout>
  );
}
