import { workflowStateCategories } from "@curved/db/constants";
import { defineQuery, type Query } from "@rocicorp/zero";
import { z } from "zod";

import { whereActive, whereArchived, whereMember, whereTrashed } from "../auth";
import type { ZeroContext } from "../context";
import { type Schema, zql } from "../schema.gen";

const workspaceArgs = z.object({ workspaceId: z.uuid() });
const teamKey = z.string().min(1).max(7);
const issueNumber = z.number().int().positive();

export const issueFilterArgs = z.object({
  workspaceId: z.uuid(),
  teamId: z.uuid().optional(),
  stateIds: z.array(z.uuid()).max(100).optional(),
  stateCategories: z.array(z.enum(workflowStateCategories)).optional(),
  priorities: z.array(z.number().int().min(0).max(4)).optional(),
  assigneeIds: z.array(z.uuid()).max(100).optional(),
  unassigned: z.boolean().optional(),
  creatorIds: z.array(z.uuid()).max(100).optional(),
  labelIds: z.array(z.uuid()).max(100).optional(),
  dueAfter: z.number().optional(),
  dueBefore: z.number().optional(),
  titleContains: z.string().max(100).optional(),
  createdAfter: z.number().optional(),
  updatedBefore: z.number().optional(),
  commentContains: z.string().max(100).optional(),
  // `sortOrder` is the Manual ordering (decision record 0006).
  sort: z
    .enum(["createdAt", "updatedAt", "title", "priority", "dueDate", "number", "sortOrder"])
    .default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(1000).default(100),
});

// Escapes LIKE wildcards so user text matches literally.
function containsPattern(text: string) {
  return `%${text.replaceAll(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Issues in one workspace that the signed-in user can see. */
function workspaceIssues(workspaceId: string, ctx: ZeroContext) {
  return whereMember(zql.issue.where("workspaceId", workspaceId), ctx);
}

// Lists return plain issue rows. A view looks up each issue's team and state
// in `teams.byWorkspace`, which has every team and state. Relating them on
// every row made the first load of 20,000 issues about 30% slower.

function newestFirst<TReturn>(query: Query<"issue", Schema, TReturn>) {
  return query.orderBy("createdAt", "desc").orderBy("id", "desc");
}

/**
 * Everything the issue page shows. An archived or trashed issue still opens,
 * so this adds no archive filter to the issue itself. Sub-issues in the Trash
 * are left out.
 */
function issueDetails<TReturn>(query: Query<"issue", Schema, TReturn>) {
  return (
    query
      .related("description")
      .related("state")
      .related("team")
      .related("assignee")
      .related("creator")
      // Zero 1.11.3 cannot order a many-to-many relationship, so the UI sorts labels.
      .related("labels")
      .related("parent", (parent) => parent.related("team").related("state"))
      .related("children", (children) =>
        children
          .where("deletedAt", "IS", null)
          .related("state")
          .related("team")
          .orderBy("sortOrder", "asc")
          .orderBy("id", "asc"),
      )
      .related("comments", (comments) =>
        comments.related("author").orderBy("createdAt", "asc").orderBy("id", "asc"),
      )
  );
}

export const issueQueries = {
  /** Active issues in a workspace, newest first. */
  byWorkspace: defineQuery(workspaceArgs, ({ args: { workspaceId }, ctx }) =>
    newestFirst(whereActive(workspaceIssues(workspaceId, ctx))),
  ),

  /** Active issues in a team, in Manual order. */
  byTeam: defineQuery(
    z.object({ workspaceId: z.uuid(), teamId: z.uuid() }),
    ({ args: { workspaceId, teamId }, ctx }) =>
      whereActive(workspaceIssues(workspaceId, ctx).where("teamId", teamId))
        .orderBy("sortOrder", "asc")
        .orderBy("id", "asc"),
  ),

  /** My issues: active issues assigned to the signed-in user. */
  mine: defineQuery(workspaceArgs, ({ args: { workspaceId }, ctx }) =>
    newestFirst(whereActive(workspaceIssues(workspaceId, ctx).where("assigneeId", ctx.userID))),
  ),

  /** Archived issues, for the "Show archived" filter. */
  archived: defineQuery(workspaceArgs, ({ args: { workspaceId }, ctx }) =>
    whereArchived(workspaceIssues(workspaceId, ctx))
      .orderBy("archivedAt", "desc")
      .orderBy("id", "desc"),
  ),

  /** Issues in the Trash, most recently trashed first. */
  trashed: defineQuery(workspaceArgs, ({ args: { workspaceId }, ctx }) =>
    whereTrashed(workspaceIssues(workspaceId, ctx))
      .orderBy("deletedAt", "desc")
      .orderBy("id", "desc"),
  ),

  /** Opens an issue by UUID, such as one whose number is still pending. */
  byId: defineQuery(z.object({ id: z.uuid() }), ({ args: { id }, ctx }) =>
    issueDetails(whereMember(zql.issue.where("id", id), ctx)).one(),
  ),

  /**
   * Opens an issue by its key, such as `ENG-123`. When this finds nothing,
   * the route tries `issueKeyAliases.byKey`.
   */
  byKey: defineQuery(
    z.object({ workspaceId: z.uuid(), teamKey, number: issueNumber }),
    ({ args: { workspaceId, teamKey: key, number }, ctx }) =>
      issueDetails(
        workspaceIssues(workspaceId, ctx)
          .where("number", number)
          .whereExists("team", (team) => team.where("key", key)),
      ).one(),
  ),

  /** Filters and sorts active issues, for views. */
  byFilter: defineQuery(issueFilterArgs, ({ args, ctx }) => {
    let query = whereActive(workspaceIssues(args.workspaceId, ctx));
    if (args.teamId) {
      query = query.where("teamId", args.teamId);
    }
    if (args.stateIds) {
      query = query.where("stateId", "IN", args.stateIds);
    }
    const { stateCategories } = args;
    if (stateCategories) {
      query = query.whereExists("state", (state) => state.where("category", "IN", stateCategories));
    }
    if (args.priorities) {
      query = query.where("priority", "IN", args.priorities);
    }
    const { assigneeIds, unassigned } = args;
    if (assigneeIds && unassigned) {
      query = query.where((eb) =>
        eb.or(eb.cmp("assigneeId", "IN", assigneeIds), eb.cmp("assigneeId", "IS", null)),
      );
    } else if (assigneeIds) {
      query = query.where("assigneeId", "IN", assigneeIds);
    } else if (unassigned) {
      query = query.where("assigneeId", "IS", null);
    }
    if (args.creatorIds) {
      query = query.where("creatorId", "IN", args.creatorIds);
    }
    const { labelIds } = args;
    if (labelIds) {
      query = query.whereExists("labels", (labels) => labels.where("id", "IN", labelIds));
    }
    if (args.dueAfter !== undefined) {
      query = query.where("dueDate", ">=", args.dueAfter);
    }
    if (args.dueBefore !== undefined) {
      query = query.where("dueDate", "<", args.dueBefore);
    }
    if (args.titleContains) {
      query = query.where("title", "ILIKE", containsPattern(args.titleContains));
    }
    if (args.createdAfter !== undefined) {
      query = query.where("createdAt", ">=", args.createdAfter);
    }
    if (args.updatedBefore !== undefined) {
      query = query.where("updatedAt", "<", args.updatedBefore);
    }
    const { commentContains } = args;
    if (commentContains) {
      query = query.whereExists("comments", (comments) =>
        comments.where("body", "ILIKE", containsPattern(commentContains)),
      );
    }
    return query.orderBy(args.sort, args.direction).orderBy("id", args.direction).limit(args.limit);
  }),
};

export const issueKeyAliasQueries = {
  /** Finds where an old key, from before the issue moved to another team, points. */
  byKey: defineQuery(
    z.object({ workspaceId: z.uuid(), teamKey, number: issueNumber }),
    ({ args: { workspaceId, teamKey: key, number }, ctx }) =>
      whereMember(
        zql.issueKeyAlias
          .where("workspaceId", workspaceId)
          .where("number", number)
          .whereExists("team", (team) => team.where("key", key)),
        ctx,
      )
        .related("issue", (issue) => issue.related("team"))
        .one(),
  ),
};
