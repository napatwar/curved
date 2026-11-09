import type { Workspace } from "@curved/zero";
import { createContext, type ReactNode, use } from "react";

const WorkspaceContext = createContext<Workspace | null>(null);

/** Gives the pages under `/$workspaceSlug` the workspace in the URL. */
export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  return <WorkspaceContext value={workspace}>{children}</WorkspaceContext>;
}

/** The workspace in the URL. Only for pages under `/$workspaceSlug`. */
export function useWorkspace(): Workspace {
  const workspace = use(WorkspaceContext);
  if (!workspace) {
    throw new Error("useWorkspace needs a WorkspaceProvider");
  }
  return workspace;
}
