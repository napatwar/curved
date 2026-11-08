import { createContext, type ReactNode, use } from "react";

import type { TeamWithStates } from "./use-teams";

const TeamContext = createContext<TeamWithStates | null>(null);

/** Gives the pages under `/$workspaceSlug/team/$teamKey` the team in the URL. */
export function TeamProvider({ team, children }: { team: TeamWithStates; children: ReactNode }) {
  return <TeamContext value={team}>{children}</TeamContext>;
}

/** The team in the URL, with its workflow states. Only for pages under a team. */
export function useTeam(): TeamWithStates {
  const team = use(TeamContext);
  if (!team) {
    throw new Error("useTeam needs a TeamProvider");
  }
  return team;
}
