import type { Team, Workspace } from "@curved/zero";
import { Link } from "@tanstack/react-router";
import { Archive, CircleUser, Layers, ListTodo, Settings, Trash2 } from "lucide-react";

import { ConnectionStatus } from "@/components/connection-status";
import { SidebarSection, sidebarItemClass } from "@/components/sidebar";
import { WorkspaceMenu } from "@/features/workspaces";

/**
 * The workspace's navigation. With one team it links to that team's issues
 * as "Issues" and hides teams (decision record 0006).
 */
export function AppSidebar({
  workspace,
  workspaces,
  teams,
}: {
  workspace: Workspace;
  workspaces: readonly Workspace[];
  teams: readonly Team[];
}) {
  const workspaceSlug = workspace.slug;
  const [onlyTeam] = teams.length === 1 ? teams : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-2">
      <WorkspaceMenu current={workspace} workspaces={workspaces} />

      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <SidebarSection>
          <li>
            <Link
              className={sidebarItemClass}
              params={{ workspaceSlug }}
              to="/$workspaceSlug/my-issues"
            >
              <CircleUser />
              My issues
            </Link>
          </li>
          {onlyTeam && (
            <li>
              <Link
                activeOptions={{ exact: false }}
                className={sidebarItemClass}
                params={{ workspaceSlug, teamKey: onlyTeam.key }}
                to="/$workspaceSlug/team/$teamKey/issues"
              >
                <ListTodo />
                Issues
              </Link>
            </li>
          )}
          <li>
            <Link
              className={sidebarItemClass}
              params={{ workspaceSlug }}
              to="/$workspaceSlug/views"
            >
              <Layers />
              Views
            </Link>
          </li>
        </SidebarSection>

        {teams.length > 1 && (
          <SidebarSection title="Teams">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  className={sidebarItemClass}
                  params={{ workspaceSlug, teamKey: team.key }}
                  to="/$workspaceSlug/team/$teamKey/issues"
                >
                  <span
                    aria-hidden
                    className="flex h-4 min-w-6 shrink-0 items-center justify-center rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground"
                  >
                    {team.key}
                  </span>
                  <span className="min-w-0 truncate">{team.name}</span>
                </Link>
              </li>
            ))}
          </SidebarSection>
        )}

        <div className="mt-auto">
          <SidebarSection>
            <li>
              <Link
                className={sidebarItemClass}
                params={{ workspaceSlug }}
                to="/$workspaceSlug/archive"
              >
                <Archive />
                Archive
              </Link>
            </li>
            <li>
              <Link
                className={sidebarItemClass}
                params={{ workspaceSlug }}
                to="/$workspaceSlug/trash"
              >
                <Trash2 />
                Trash
              </Link>
            </li>
            <li>
              <Link
                className={sidebarItemClass}
                params={{ workspaceSlug }}
                to="/$workspaceSlug/settings"
              >
                <Settings />
                Settings
              </Link>
            </li>
          </SidebarSection>
        </div>
      </nav>

      <ConnectionStatus />
    </div>
  );
}
