import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AuthLayout } from "@/components/auth-layout";

/** A full page for an address that leads nowhere, outside any workspace. */
export function NotFoundPage({
  title = "Page not found",
  children = "This address does not lead to a page in Curved.",
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <AuthLayout title={title}>
      <p className="text-muted-foreground">{children}</p>
      <Link className="text-primary underline-offset-4 hover:underline" to="/">
        Go to your workspaces
      </Link>
    </AuthLayout>
  );
}
