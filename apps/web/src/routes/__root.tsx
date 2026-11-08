import { ZeroProvider } from "@rocicorp/zero/react";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { zeroOptions } from "@/lib/zero";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ZeroProvider {...zeroOptions}>
      <Outlet />
    </ZeroProvider>
  );
}
