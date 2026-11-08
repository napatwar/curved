import { createRootRoute, Outlet } from "@tanstack/react-router";

import { ErrorState } from "@/components/error-state";
import { NotFoundPage } from "@/components/not-found-page";

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: ({ reset }) => (
    <main className="flex min-h-svh flex-col">
      <ErrorState onRetry={reset} />
    </main>
  ),
});
