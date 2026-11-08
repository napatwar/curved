import type { Query } from "@rocicorp/zero";

import type { ZeroContext } from "../context";
import { type Schema, zql } from "../schema.gen";

type Relationships = Schema["relationships"];

/** Tables that belong to one workspace through a `workspace` relationship. */
export type WorkspaceTable = {
  [T in keyof Relationships]: "workspace" extends keyof Relationships[T] ? T : never;
}[keyof Relationships];

/**
 * Limits a query to rows in workspaces where the signed-in user is a member
 * (decision record 0005). Every query on a workspace table must use it.
 * zero-cache keeps the filter up to date, so removing a member removes the
 * workspace's rows from their client.
 */
export function whereMember<TTable extends WorkspaceTable, TReturn>(
  query: Query<TTable, Schema, TReturn>,
  ctx: ZeroContext,
): Query<TTable, Schema, TReturn> {
  // Every workspace table has the same `workspace` relationship, but
  // TypeScript cannot follow it through the generic table name.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const issueQuery = query as unknown as Query<"issue", Schema, TReturn>;
  const filtered = issueQuery.whereExists("workspace", (workspace) =>
    workspace.whereExists("members", (member) => member.where("userId", ctx.userID)),
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return filtered as unknown as Query<TTable, Schema, TReturn>;
}

/** Workspaces where the signed-in user is a member. */
export function memberWorkspaces(ctx: ZeroContext) {
  return zql.workspace.whereExists("members", (member) => member.where("userId", ctx.userID));
}

/** Users who share at least one workspace with the signed-in user. */
export function visibleUsers(ctx: ZeroContext) {
  return zql.user.whereExists("memberships", (membership) => whereMember(membership, ctx));
}
