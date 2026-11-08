import { markdownLimits, pendingIssueNumber } from "@curved/db/constants";
import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

import { adminRoles, assertMember, assertMemberOfRow, notFound } from "../auth";
import { zql } from "../schema.gen";
import {
  assertLabelsFit,
  assertNewId,
  assertParentFits,
  assertTeamState,
  assertWorkspaceMember,
  definedOnly,
  dueDate,
  invalid,
  isServer,
  keyBeforeFirst,
  priority,
  sortOrder,
  type Tx,
} from "./shared";

/**
 * Returns the number for a new issue in a team. The client inserts
 * `pendingIssueNumber` (0), and the UI shows `ENG-…` until the server's
 * number arrives. The server allocates from `team.next_issue_number` in the
 * mutation's transaction (apps/api/src/zero/server-mutators.ts), so the SQL
 * never reaches the browser (decision record 0006).
 */
export type IssueNumberAllocator = (tx: Tx, teamId: string) => Promise<number>;

/** The client's allocator. Postgres rejects 0, so a server must replace it. */
export const pendingNumber: IssueNumberAllocator = async () => pendingIssueNumber;

const issueId = z.object({ id: z.uuid() });
const title = z.string().trim().min(1).max(255);
const description = z.string().max(markdownLimits.description);

export const createIssueArgs = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  teamId: z.uuid(),
  title,
  description: description.default(""),
  /** Defaults to the team's default state. */
  stateId: z.uuid().optional(),
  priority: priority.default(0),
  assigneeId: z.uuid().nullable().default(null),
  dueDate: dueDate.nullable().default(null),
  parentId: z.uuid().nullable().default(null),
  labelIds: z.array(z.uuid()).max(50).default([]),
});

export const updateIssueArgs = z.object({
  id: z.uuid(),
  title: title.optional(),
  stateId: z.uuid().optional(),
  priority: priority.optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: dueDate.nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  /** The Manual order, from `fractional-indexing`. */
  sortOrder: sortOrder.optional(),
});

export const moveIssueToTeamArgs = z.object({
  id: z.uuid(),
  teamId: z.uuid(),
  /** The ID of the `issue_key_alias` row that keeps the old key working. */
  aliasId: z.uuid(),
});

export const issueLabelArgs = z.object({ issueId: z.uuid(), labelId: z.uuid() });

export const setIssueDescriptionArgs = z.object({ issueId: z.uuid(), body: description });

/** `issues.create`, with the number allocator for where it runs. */
export function defineCreateIssue(allocateNumber: IssueNumberAllocator) {
  return defineMutator(createIssueArgs, async ({ args, ctx, tx }) => {
    const { id, workspaceId, teamId } = args;
    await assertMember(tx, ctx, workspaceId);
    const team = await tx.run(zql.team.where("id", teamId).one());
    if (isServer(tx)) {
      if (team?.workspaceId !== workspaceId) {
        throw notFound();
      }
      await assertNewId(tx, "issue", id);
    }
    const stateId = args.stateId ?? team?.defaultStateId;
    if (!stateId) {
      throw invalid("The team has not loaded yet. Try again.");
    }
    if (isServer(tx)) {
      await assertTeamState(tx, stateId, teamId);
      if (args.assigneeId) {
        await assertWorkspaceMember(tx, workspaceId, args.assigneeId);
      }
      if (args.parentId) {
        await assertParentFits(tx, args.parentId, workspaceId, id);
      }
      await assertLabelsFit(tx, args.labelIds, workspaceId, teamId);
    }

    // Allocate first: on the server, this locks the team's row until the
    // transaction ends, so the lowest sort key read next is current too.
    const number = await allocateNumber(tx, teamId);
    const now = Date.now();
    await tx.mutate.issue.insert({
      id,
      workspaceId,
      teamId,
      number,
      title: args.title,
      stateId,
      priority: args.priority,
      assigneeId: args.assigneeId,
      creatorId: ctx.userID,
      dueDate: args.dueDate,
      parentId: args.parentId,
      sortOrder: await keyBeforeFirst(tx, teamId),
      archivedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.mutate.issueDescription.insert({
      issueId: id,
      workspaceId,
      body: args.description,
      createdAt: now,
      updatedAt: now,
    });
    for (const labelId of new Set(args.labelIds)) {
      await tx.mutate.issueLabel.upsert({ workspaceId, issueId: id, labelId, createdAt: now });
    }
  });
}

/**
 * `issues.moveToTeam`: the issue gets a new number in the other team, and its
 * old key goes into `issue_key_alias`. It takes a state of the same category
 * there, goes to the top of that team, and loses the old team's labels.
 */
export function defineMoveIssueToTeam(allocateNumber: IssueNumberAllocator) {
  return defineMutator(moveIssueToTeamArgs, async ({ args, ctx, tx }) => {
    const { id, teamId } = args;
    await assertMemberOfRow(tx, ctx, "issue", id);
    const issue = await tx.run(zql.issue.where("id", id).related("labels").related("state").one());
    if (!issue || issue.teamId === teamId) {
      return;
    }
    const team = await tx.run(
      zql.team
        .where("id", teamId)
        .related("states", (states) => states.orderBy("position", "asc").orderBy("id", "asc"))
        .one(),
    );
    if (isServer(tx) && team?.workspaceId !== issue.workspaceId) {
      throw notFound();
    }
    if (!team) {
      throw invalid("The team has not loaded yet. Try again.");
    }
    const state =
      team.states.find((candidate) => candidate.category === issue.state?.category) ??
      team.states.find((candidate) => candidate.id === team.defaultStateId);
    if (!state) {
      throw invalid("The team has no states.");
    }

    const number = await allocateNumber(tx, teamId);
    const now = Date.now();
    if (issue.number !== pendingIssueNumber) {
      await tx.mutate.issueKeyAlias.insert({
        id: args.aliasId,
        workspaceId: issue.workspaceId,
        teamId: issue.teamId,
        number: issue.number,
        issueId: id,
        createdAt: now,
      });
    }
    for (const label of issue.labels) {
      if (label.teamId && label.teamId !== teamId) {
        await tx.mutate.issueLabel.delete({ issueId: id, labelId: label.id });
      }
    }
    await tx.mutate.issue.update({
      id,
      teamId,
      number,
      stateId: state.id,
      sortOrder: await keyBeforeFirst(tx, teamId),
      updatedAt: now,
    });
  });
}

function setRemoval(column: "archivedAt" | "deletedAt", removed: boolean) {
  return defineMutator(issueId, async ({ args: { id }, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "issue", id);
    const now = Date.now();
    await tx.mutate.issue.update({ id, [column]: removed ? now : null, updatedAt: now });
  });
}

export const issueMutators = {
  create: defineCreateIssue(pendingNumber),

  /** Changes any of the issue's own fields. Moving to another team is `moveToTeam`. */
  update: defineMutator(updateIssueArgs, async ({ args, ctx, tx }) => {
    const { id } = args;
    const workspaceId = await assertMemberOfRow(tx, ctx, "issue", id);
    if (workspaceId !== undefined) {
      const issue = await tx.run(zql.issue.where("id", id).one());
      if (!issue) {
        throw notFound();
      }
      if (args.stateId) {
        await assertTeamState(tx, args.stateId, issue.teamId);
      }
      if (args.assigneeId) {
        await assertWorkspaceMember(tx, workspaceId, args.assigneeId);
      }
      if (args.parentId) {
        await assertParentFits(tx, args.parentId, workspaceId, id);
      }
    }
    await tx.mutate.issue.update({
      ...definedOnly({
        title: args.title,
        stateId: args.stateId,
        priority: args.priority,
        assigneeId: args.assigneeId,
        dueDate: args.dueDate,
        parentId: args.parentId,
        sortOrder: args.sortOrder,
      }),
      id,
      updatedAt: Date.now(),
    });
  }),

  moveToTeam: defineMoveIssueToTeam(pendingNumber),

  setDescription: defineMutator(
    setIssueDescriptionArgs,
    async ({ args: { issueId: id, body }, ctx, tx }) => {
      const workspaceId =
        (await assertMemberOfRow(tx, ctx, "issue", id)) ??
        (await tx.run(zql.issue.where("id", id).one()))?.workspaceId;
      if (!workspaceId) {
        // The client has not synced the issue. The server will save it.
        return;
      }
      const now = Date.now();
      const existing = await tx.run(zql.issueDescription.where("issueId", id).one());
      if (existing) {
        await tx.mutate.issueDescription.update({ issueId: id, body, updatedAt: now });
      } else {
        await tx.mutate.issueDescription.insert({
          issueId: id,
          workspaceId,
          body,
          createdAt: now,
          updatedAt: now,
        });
      }
    },
  ),

  addLabel: defineMutator(issueLabelArgs, async ({ args: { issueId: id, labelId }, ctx, tx }) => {
    const workspaceId = await assertMemberOfRow(tx, ctx, "issue", id);
    const issue = await tx.run(zql.issue.where("id", id).one());
    if (!issue) {
      return;
    }
    if (workspaceId !== undefined) {
      await assertLabelsFit(tx, [labelId], workspaceId, issue.teamId);
    }
    await tx.mutate.issueLabel.upsert({
      workspaceId: issue.workspaceId,
      issueId: id,
      labelId,
      createdAt: Date.now(),
    });
  }),

  removeLabel: defineMutator(
    issueLabelArgs,
    async ({ args: { issueId: id, labelId }, ctx, tx }) => {
      await assertMemberOfRow(tx, ctx, "issue", id);
      await tx.mutate.issueLabel.delete({ issueId: id, labelId });
    },
  ),

  archive: setRemoval("archivedAt", true),
  unarchive: setRemoval("archivedAt", false),
  /** Moves the issue to the Trash. Its sub-issues stay where they are. */
  trash: setRemoval("deletedAt", true),
  restore: setRemoval("deletedAt", false),

  /**
   * Deletes an issue in the Trash for good. Only admins and owners can.
   * Its sub-issues lose their parent, and Postgres deletes its comments,
   * labels, description and key aliases.
   */
  deletePermanently: defineMutator(issueId, async ({ args: { id }, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "issue", id, adminRoles);
    const issue = await tx.run(zql.issue.where("id", id).one());
    if (!issue) {
      return;
    }
    if (issue.deletedAt === null) {
      throw invalid("Move the issue to the Trash before deleting it permanently.");
    }
    const now = Date.now();
    for (const child of await tx.run(zql.issue.where("parentId", id))) {
      await tx.mutate.issue.update({ id: child.id, parentId: null, updatedAt: now });
    }
    await tx.mutate.issue.delete({ id });
  }),
};
