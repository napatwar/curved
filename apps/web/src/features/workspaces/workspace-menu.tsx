import type { Workspace } from "@curved/zero";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Settings } from "lucide-react";

import { ThemeSubmenu } from "@/components/theme-submenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/auth";

import { WorkspaceAvatar } from "./workspace-avatar";

/**
 * The menu at the top of the sidebar. It switches workspaces and holds the
 * workspace settings, the theme and signing out.
 */
export function WorkspaceMenu({
  current,
  workspaces,
}: {
  current: Workspace;
  workspaces: readonly Workspace[];
}) {
  const navigate = useNavigate();
  const { signOut, pending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Workspace menu, ${current.name}`}
        className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left font-semibold outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring data-popup-open:bg-sidebar-accent"
      >
        <WorkspaceAvatar name={current.name} />
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(slug: string) =>
              void navigate({ to: "/$workspaceSlug", params: { workspaceSlug: slug } })
            }
            value={current.slug}
          >
            {workspaces.map((workspace) => (
              <DropdownMenuRadioItem key={workspace.id} value={workspace.slug}>
                <WorkspaceAvatar name={workspace.name} />
                <span className="min-w-0 truncate">{workspace.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            void navigate({
              to: "/$workspaceSlug/settings",
              params: { workspaceSlug: current.slug },
            })
          }
        >
          <Settings />
          Workspace settings
        </DropdownMenuItem>
        <ThemeSubmenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
