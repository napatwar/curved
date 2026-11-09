import {
  defaultIssueCategory,
  defaultWorkflowStates,
  teamKeyPattern,
  workflowStateCategories,
} from "@curved/db/constants";
import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

import { adminRoles, assertMember, assertMemberOfRow } from "../auth";
import { zql } from "../schema.gen";
import { assertNewId, color, definedOnly, invalid, isServer, name } from "./shared";

// Only admins and owners manage teams and workflow states (decision record 0006).

const teamKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(teamKeyPattern, "Use 1 to 7 letters or digits, starting with a letter.");

export const createTeamArgs = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  key: teamKey,
  name,
  /** IDs for the default states, in the order of `defaultWorkflowStates`. */
  stateIds: z.array(z.uuid()).length(defaultWorkflowStates.length),
});

export const createWorkflowStateArgs = z.object({
  id: z.uuid(),
  teamId: z.uuid(),
  name,
  color,
  category: z.enum(workflowStateCategories),
});

export const updateWorkflowStateArgs = z.object({
  id: z.uuid(),
  name: name.optional(),
  color: color.optional(),
});

export const reorderWorkflowStatesArgs = z.object({
  teamId: z.uuid(),
  /** Every state of the team, in the new order. */
  stateIds: z.array(z.uuid()).min(1).max(100),
});

export const deleteWorkflowStateArgs = z.object({
  id: z.uuid(),
  /** Where the state's issues go, in the same team. */
  targetStateId: z.uuid(),
});

export const teamMutators = {
  /** Creates a team with the default states, one per category. */
  create: defineMutator(createTeamArgs, async ({ args, ctx, tx }) => {
    const { id, workspaceId, key, stateIds } = args;
    await assertMember(tx, ctx, workspaceId, adminRoles);
    if (isServer(tx)) {
      await assertNewId(tx, "team", id);
      for (const stateId of stateIds) {
        await assertNewId(tx, "workflowState", stateId);
      }
      const sameKey = await tx.run(
        zql.team.where("workspaceId", workspaceId).where("key", key).one(),
      );
      if (sameKey) {
        throw invalid("Another team in this workspace uses this key.");
      }
    }
    const states = defaultWorkflowStates.map((state, position) => ({
      ...state,
      id: stateIds[position] ?? "",
      position,
    }));
    const defaultState = states.find((state) => state.category === defaultIssueCategory);
    if (!defaultState || new Set(stateIds).size !== stateIds.length) {
      throw invalid("Each state needs its own ID.");
    }
    const now = Date.now();
    // `team.default_state_id` is a deferred foreign key, so the team can come
    // before its states.
    await tx.mutate.team.insert({
      id,
      workspaceId,
      key,
      name: args.name,
      nextIssueNumber: 1,
      defaultStateId: defaultState.id,
      createdAt: now,
      updatedAt: now,
    });
    for (const state of states) {
      await tx.mutate.workflowState.insert({
        ...state,
        workspaceId,
        teamId: id,
        createdAt: now,
        updatedAt: now,
      });
    }
  }),

  rename: defineMutator(z.object({ id: z.uuid(), name }), async ({ args, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "team", args.id, adminRoles);
    await tx.mutate.team.update({ id: args.id, name: args.name, updatedAt: Date.now() });
  }),

  /** Sets the state that new issues get. */
  setDefaultState: defineMutator(
    z.object({ id: z.uuid(), stateId: z.uuid() }),
    async ({ args: { id, stateId }, ctx, tx }) => {
      await assertMemberOfRow(tx, ctx, "team", id, adminRoles);
      if (isServer(tx)) {
        const state = await tx.run(zql.workflowState.where("id", stateId).one());
        if (state?.teamId !== id) {
          throw invalid("The state does not belong to this team.");
        }
      }
      await tx.mutate.team.update({ id, defaultStateId: stateId, updatedAt: Date.now() });
    },
  ),

  /**
   * Deletes a team with no issues, including archived and trashed ones. A
   * workspace keeps at least one team. Postgres deletes its states, labels
   * and key aliases.
   */
  delete: defineMutator(z.object({ id: z.uuid() }), async ({ args: { id }, ctx, tx }) => {
    const workspaceId = await assertMemberOfRow(tx, ctx, "team", id, adminRoles);
    if (workspaceId !== undefined) {
      if (await tx.run(zql.issue.where("teamId", id).one())) {
        throw invalid(
          "Move or delete the team's issues first, including archived and trashed ones.",
        );
      }
      const teams = await tx.run(zql.team.where("workspaceId", workspaceId).limit(2));
      if (teams.length < 2) {
        throw invalid("A workspace needs at least one team.");
      }
    }
    for (const label of await tx.run(zql.label.where("teamId", id))) {
      await tx.mutate.label.delete({ id: label.id });
    }
    for (const state of await tx.run(zql.workflowState.where("teamId", id))) {
      await tx.mutate.workflowState.delete({ id: state.id });
    }
    await tx.mutate.team.delete({ id });
  }),
};

export const workflowStateMutators = {
  /** Adds a state at the end of the team's list. */
  create: defineMutator(createWorkflowStateArgs, async ({ args, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "team", args.teamId, adminRoles);
    await assertNewId(tx, "workflowState", args.id);
    const team = await tx.run(
      zql.team
        .where("id", args.teamId)
        .related("states", (states) => states.orderBy("position", "desc").limit(1))
        .one(),
    );
    if (!team) {
      return;
    }
    const now = Date.now();
    await tx.mutate.workflowState.insert({
      ...args,
      workspaceId: team.workspaceId,
      position: (team.states[0]?.position ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    });
  }),

  /** Renames or recolors a state. Its category never changes. */
  update: defineMutator(updateWorkflowStateArgs, async ({ args, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "workflowState", args.id, adminRoles);
    await tx.mutate.workflowState.update({
      ...definedOnly({ name: args.name, color: args.color }),
      id: args.id,
      updatedAt: Date.now(),
    });
  }),

  /** Renumbers every state of the team in the given order. */
  reorder: defineMutator(reorderWorkflowStatesArgs, async ({ args, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "team", args.teamId, adminRoles);
    const states = await tx.run(zql.workflowState.where("teamId", args.teamId));
    const current = new Set(states.map((state) => state.id));
    const sameStates =
      args.stateIds.length === current.size && args.stateIds.every((id) => current.has(id));
    if (!sameStates) {
      if (isServer(tx)) {
        throw invalid("List every state of the team exactly once.");
      }
      return;
    }
    const now = Date.now();
    for (const [position, id] of args.stateIds.entries()) {
      if (states.find((state) => state.id === id)?.position !== position) {
        await tx.mutate.workflowState.update({ id, position, updatedAt: now });
      }
    }
  }),

  /**
   * Deletes a state and moves its issues to `targetStateId`. Every category
   * keeps at least one state. If it was the team's default, the target
   * becomes the default.
   */
  delete: defineMutator(
    deleteWorkflowStateArgs,
    async ({ args: { id, targetStateId }, ctx, tx }) => {
      await assertMemberOfRow(tx, ctx, "workflowState", id, adminRoles);
      const state = await tx.run(zql.workflowState.where("id", id).related("team").one());
      if (!state) {
        return;
      }
      if (isServer(tx)) {
        const target = await tx.run(zql.workflowState.where("id", targetStateId).one());
        if (target?.teamId !== state.teamId || target.id === id) {
          throw invalid("Pick another state of the same team for its issues.");
        }
        const sameCategory = await tx.run(
          zql.workflowState
            .where("teamId", state.teamId)
            .where("category", state.category)
            .where("id", "!=", id)
            .one(),
        );
        if (!sameCategory) {
          throw invalid("Each category needs at least one state.");
        }
      }
      const now = Date.now();
      for (const issue of await tx.run(zql.issue.where("stateId", id))) {
        await tx.mutate.issue.update({ id: issue.id, stateId: targetStateId, updatedAt: now });
      }
      if (state.team?.defaultStateId === id) {
        await tx.mutate.team.update({
          id: state.teamId,
          defaultStateId: targetStateId,
          updatedAt: now,
        });
      }
      await tx.mutate.workflowState.delete({ id });
    },
  ),
};
