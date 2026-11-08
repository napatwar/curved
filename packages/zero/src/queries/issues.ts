import { issueStatuses } from "@curved/db/constants";
import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";

import { whereMember } from "../auth";
import { zql } from "../schema.gen";

export const issueFilterArgs = z.object({
  workspaceId: z.uuid(),
  statuses: z.array(z.enum(issueStatuses)).optional(),
  titleContains: z.string().max(100).optional(),
  createdAfter: z.number().optional(),
  updatedBefore: z.number().optional(),
  commentContains: z.string().max(100).optional(),
  sort: z.enum(["createdAt", "updatedAt", "title", "status"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(1000).default(100),
});

// Escapes LIKE wildcards so user text matches literally.
function containsPattern(text: string) {
  return `%${text.replaceAll(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export const issueQueries = {
  byWorkspace: defineQuery(z.object({ workspaceId: z.uuid() }), ({ args: { workspaceId }, ctx }) =>
    whereMember(zql.issue.where("workspaceId", workspaceId), ctx)
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc"),
  ),
  // Added for the Zero spike (decision record 0004) to measure filter and sort
  // changes. No screen uses it yet.
  byFilter: defineQuery(issueFilterArgs, ({ args, ctx }) => {
    let query = whereMember(zql.issue.where("workspaceId", args.workspaceId), ctx);
    if (args.statuses) {
      query = query.where("status", "IN", args.statuses);
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
