import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { ErrorState } from "@/components/error-state";
import { startThemeSync } from "@/lib/theme";

import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  // A page that fails keeps the layout around it, such as the sidebar.
  defaultErrorComponent: ({ reset }) => <ErrorState onRetry={reset} />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

startThemeSync();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
