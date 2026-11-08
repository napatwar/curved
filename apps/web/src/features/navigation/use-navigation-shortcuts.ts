import { useNavigate, useParams } from "@tanstack/react-router";

import { useShortcut } from "@/hooks/use-shortcut";

/**
 * "G, then a letter" moves around the workspace. Registered once by the
 * workspace layout, so the command palette can list the same commands.
 */
export function useNavigationShortcuts(workspaceSlug: string, teamKeys: readonly string[]) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  // The team on screen, or the first team.
  const teamKey = params.teamKey ?? teamKeys[0];
  const group = "Navigation";

  useShortcut({
    id: "navigation.my-issues",
    keys: "g m",
    title: "Go to My issues",
    group,
    run: () => void navigate({ to: "/$workspaceSlug/my-issues", params: { workspaceSlug } }),
  });
  useShortcut({
    id: "navigation.issues",
    keys: "g i",
    title: "Go to issues",
    group,
    enabled: Boolean(teamKey),
    run: () => {
      if (teamKey) {
        void navigate({
          to: "/$workspaceSlug/team/$teamKey/issues",
          params: { workspaceSlug, teamKey },
        });
      }
    },
  });
  useShortcut({
    id: "navigation.settings",
    keys: "g s",
    title: "Go to settings",
    group,
    run: () => void navigate({ to: "/$workspaceSlug/settings", params: { workspaceSlug } }),
  });
}
