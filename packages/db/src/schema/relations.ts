import { relations } from "drizzle-orm";

import { user, workspace, workspaceMember } from "./auth";
import { comment } from "./comment";
import { issue } from "./issue";

// drizzle-zero turns these into Zero relationships. Every tenant table needs a
// `workspace` relationship, so queries can filter by membership
// (packages/zero/src/auth/membership.ts). Tenant tables have no foreign
// key to `workspace`, so tenant data can move to cells later (decision
// record 0005).
export const issueRelations = relations(issue, ({ many, one }) => ({
  workspace: one(workspace, { fields: [issue.workspaceId], references: [workspace.id] }),
  comments: many(comment),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  workspace: one(workspace, { fields: [comment.workspaceId], references: [workspace.id] }),
  issue: one(issue, { fields: [comment.issueId], references: [issue.id] }),
}));

export const workspaceRelations = relations(workspace, ({ many }) => ({
  members: many(workspaceMember),
}));

export const workspaceMemberRelations = relations(workspaceMember, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceMember.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, { fields: [workspaceMember.userId], references: [user.id] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  memberships: many(workspaceMember),
}));
