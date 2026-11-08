import { ZeroProvider } from "@rocicorp/zero/react";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { useExposeZero } from "@/hooks/use-expose-zero";
import { zeroOptions } from "@/lib/zero";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ZeroProvider {...zeroOptions}>
      <ExposeZero />
      <Outlet />
    </ZeroProvider>
  );
}

function ExposeZero() {
  useExposeZero();
  return null;
}
