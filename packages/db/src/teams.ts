import { v7 as uuidv7 } from "uuid";

import { defaultIssueCategory, defaultWorkflowStates } from "./constants";
import type { Db } from "./index";
import { team, workflowState } from "./schema";

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type NewTeam = {
  workspaceId: string;
  key: string;
  name: string;
  /** Fixed IDs, such as for the development seed. New UUIDv7s otherwise. */
  id?: string;
  stateIds?: readonly string[];
};

/**
 * Creates a team with the default workflow states, outside Zero: for a new
 * workspace's first team, the seeds and tests. Zero clients use the
 * `teams.create` mutator instead.
 */
export async function createTeam(db: Db | DbTransaction, input: NewTeam) {
  const teamId = input.id ?? uuidv7();
  const now = new Date();
  const states = defaultWorkflowStates.map((state, position) => ({
    ...state,
    id: input.stateIds?.[position] ?? uuidv7(),
    workspaceId: input.workspaceId,
    teamId,
    position,
    createdAt: now,
    updatedAt: now,
  }));
  const defaultState = states.find((state) => state.category === defaultIssueCategory);
  if (!defaultState) {
    throw new Error(`No default state in the ${defaultIssueCategory} category`);
  }
  // `team.default_state_id` is a deferred foreign key, so the team and its
  // states go in one transaction, team first.
  await db.transaction(async (tx) => {
    await tx.insert(team).values({
      id: teamId,
      workspaceId: input.workspaceId,
      key: input.key,
      name: input.name,
      nextIssueNumber: 1,
      defaultStateId: defaultState.id,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(workflowState).values(states);
  });
  return { teamId, defaultStateId: defaultState.id, states };
}
