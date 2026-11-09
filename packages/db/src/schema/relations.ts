import { relations } from "drizzle-orm";

import { user, workspace, workspaceMember } from "./auth";
import { comment } from "./comment";
import { issue, issueDescription, issueKeyAlias } from "./issue";
import { issueLabel, label } from "./label";
import { team, workflowState } from "./team";

// drizzle-zero turns these into Zero relationships. Every tenant table needs a
// `workspace` relationship, so queries can filter by membership
// (packages/zero/src/auth/membership.ts). Tenant tables have no foreign
// key to `workspace`, so tenant data can move to cells later (decision
// record 0005).

export const teamRelations = relations(team, ({ many, one }) => ({
  workspace: one(workspace, { fields: [team.workspaceId], references: [workspace.id] }),
  states: many(workflowState, { relationName: "teamStates" }),
  defaultState: one(workflowState, {
    fields: [team.defaultStateId],
    references: [workflowState.id],
    relationName: "teamDefaultState",
  }),
  issues: many(issue),
  labels: many(label),
}));

export const workflowStateRelations = relations(workflowState, ({ many, one }) => ({
  workspace: one(workspace, { fields: [workflowState.workspaceId], references: [workspace.id] }),
  team: one(team, {
    fields: [workflowState.teamId],
    references: [team.id],
    relationName: "teamStates",
  }),
  issues: many(issue),
}));

export const issueRelations = relations(issue, ({ many, one }) => ({
  workspace: one(workspace, { fields: [issue.workspaceId], references: [workspace.id] }),
  team: one(team, { fields: [issue.teamId], references: [team.id] }),
  state: one(workflowState, { fields: [issue.stateId], references: [workflowState.id] }),
  assignee: one(user, {
    fields: [issue.assigneeId],
    references: [user.id],
    relationName: "issueAssignee",
  }),
  creator: one(user, {
    fields: [issue.creatorId],
    references: [user.id],
    relationName: "issueCreator",
  }),
  parent: one(issue, {
    fields: [issue.parentId],
    references: [issue.id],
    relationName: "issueParent",
  }),
  children: many(issue, { relationName: "issueParent" }),
  description: one(issueDescription, {
    fields: [issue.id],
    references: [issueDescription.issueId],
  }),
  // `labels`, through this junction table, comes from drizzle-zero's
  // many-to-many config in packages/zero/drizzle-zero.config.ts.
  issueLabels: many(issueLabel),
  keyAliases: many(issueKeyAlias),
  comments: many(comment),
}));

export const issueDescriptionRelations = relations(issueDescription, ({ one }) => ({
  workspace: one(workspace, {
    fields: [issueDescription.workspaceId],
    references: [workspace.id],
  }),
  issue: one(issue, { fields: [issueDescription.issueId], references: [issue.id] }),
}));

export const issueKeyAliasRelations = relations(issueKeyAlias, ({ one }) => ({
  workspace: one(workspace, { fields: [issueKeyAlias.workspaceId], references: [workspace.id] }),
  team: one(team, { fields: [issueKeyAlias.teamId], references: [team.id] }),
  issue: one(issue, { fields: [issueKeyAlias.issueId], references: [issue.id] }),
}));

export const labelRelations = relations(label, ({ many, one }) => ({
  workspace: one(workspace, { fields: [label.workspaceId], references: [workspace.id] }),
  team: one(team, { fields: [label.teamId], references: [team.id] }),
  issueLabels: many(issueLabel),
}));

export const issueLabelRelations = relations(issueLabel, ({ one }) => ({
  workspace: one(workspace, { fields: [issueLabel.workspaceId], references: [workspace.id] }),
  issue: one(issue, { fields: [issueLabel.issueId], references: [issue.id] }),
  label: one(label, { fields: [issueLabel.labelId], references: [label.id] }),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  workspace: one(workspace, { fields: [comment.workspaceId], references: [workspace.id] }),
  issue: one(issue, { fields: [comment.issueId], references: [issue.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
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
