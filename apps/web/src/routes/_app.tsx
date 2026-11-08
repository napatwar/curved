import { ZeroProvider } from "@rocicorp/zero/react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useMemo } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { SignOutButton, useZeroAuth } from "@/features/auth";
import { useExposeZero } from "@/hooks/use-expose-zero";
import { authClient } from "@/lib/auth-client";
import { createZeroOptions } from "@/lib/zero";

// Every route under this layout needs a session. Zero starts only after
// sign-in, with the user's ID.
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    return { session: data };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();
  const userID = session.user.id;
  const options = useMemo(() => createZeroOptions(userID), [userID]);

  return (
    <ZeroProvider key={userID} {...options}>
      <ZeroSession />
    </ZeroProvider>
  );
}

function ZeroSession() {
  useExposeZero();
  const authFailed = useZeroAuth();

  if (authFailed) {
    return (
      <AuthLayout title="Cannot reach your data">
        <p role="alert">
          You are signed in, but the sync server did not accept your session. Try again later.
        </p>
        <SignOutButton />
      </AuthLayout>
    );
  }
  return <Outlet />;
}
