import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app/invitations/$invitationId")({
  loader: async ({ params }) => {
    const { data } = await authClient.organization.getInvitation({
      query: { id: params.invitationId },
    });
    return { invitation: data };
  },
  component: InvitationPage,
});

function InvitationPage() {
  const { invitationId } = Route.useParams();
  const { invitation } = Route.useLoaderData();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (!invitation) {
    return (
      <AuthLayout title="Invitation not found">
        <p>This invitation has expired, was used already, or is for another email address.</p>
      </AuthLayout>
    );
  }

  async function accept() {
    const result = await authClient.organization.acceptInvitation({ invitationId });
    if (result.error) {
      setError(result.error.message ?? "Could not accept the invitation. Try again.");
      return;
    }
    await navigate({
      to: "/$workspaceSlug",
      params: { workspaceSlug: invitation?.organizationSlug ?? "" },
    });
  }

  return (
    <AuthLayout title={`Join ${invitation.organizationName}`}>
      <p>{invitation.inviterEmail} invited you to this workspace.</p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void accept()}>Accept invitation</Button>
    </AuthLayout>
  );
}
