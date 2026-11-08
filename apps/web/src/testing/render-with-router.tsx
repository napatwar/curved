import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { render } from "vitest-browser-react";

/**
 * Renders a component inside a router at `path`, for components that use
 * `Link` or router hooks. Every path renders the same component, so links can
 * be followed and checked through `router.state.location`.
 */
export async function renderWithRouter(ui: () => ReactNode, path = "/") {
  const rootRoute = createRootRoute({ component: Outlet });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/", component: ui }),
    createRoute({ getParentRoute: () => rootRoute, path: "$", component: ui }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  return { screen, router };
}
