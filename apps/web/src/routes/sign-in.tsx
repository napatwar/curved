import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { SignInForm, SocialSignIn } from "@/features/auth";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";

type SignInSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search): SignInSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await authClient.getSession();
    if (data) {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: SignInPage,
});

function SignInPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const target = safeRedirect(search.redirect);

  return (
    <AuthLayout title="Sign in to Curved">
      <SignInForm onSignedIn={() => void navigate({ href: target })} />
      <SocialSignIn callbackURL={target} />
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link className="underline" search={search} to="/sign-up">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
