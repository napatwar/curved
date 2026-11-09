import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/$workspaceSlug/team/$teamKey/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$workspaceSlug/team/$teamKey/issues", params, replace: true });
  },
});
