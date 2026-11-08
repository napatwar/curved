import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm, SocialSignIn } from "@/features/auth";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";

type SignUpSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/sign-up")({
  validateSearch: (search): SignUpSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await authClient.getSession();
    if (data) {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: SignUpPage,
});

function SignUpPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const target = safeRedirect(search.redirect);

  return (
    <AuthLayout title="Create your Curved account">
      <SignUpForm onSignedUp={() => void navigate({ href: target })} />
      <SocialSignIn callbackURL={target} />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="underline" search={search} to="/sign-in">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
