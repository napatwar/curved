import { queries } from "@curved/zero";
import { useQuery } from "@rocicorp/zero/react";

/**
 * A workspace's teams, with their workflow states, sorted by name. `complete`
 * turns true once the server has confirmed the rows, so an empty or missing
 * result can be trusted.
 */
export function useTeams(workspaceId: string) {
  const [teams, result] = useQuery(queries.teams.byWorkspace({ workspaceId }));
  return { teams, complete: result.type === "complete" };
}

export type TeamWithStates = ReturnType<typeof useTeams>["teams"][number];

/** Finds a team by its key in the URL. Keys are uppercase, so case is ignored. */
export function findTeamByKey<T extends { key: string }>(teams: readonly T[], key: string) {
  const wanted = key.toUpperCase();
  return teams.find((team) => team.key === wanted);
}
