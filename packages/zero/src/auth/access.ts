import type { Transaction } from "@rocicorp/zero";

import type { ZeroContext } from "../context";
import { zql } from "../schema.gen";
import { mutationError } from "./errors";
import type { WorkspaceTable } from "./membership";

export const workspaceRoles = ["owner", "admin", "member"] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];

type Tx = Transaction;

/**
 * Checks that the signed-in user is a member of the workspace, and has one of
 * `roles` when given (decision record 0005). Every server mutator calls it
 * before writing. On the client it does nothing: client mutators only make
 * optimistic changes, and the server result always wins.
 */
export async function assertMember(
  tx: Tx,
  ctx: ZeroContext,
  workspaceId: string,
  roles?: readonly WorkspaceRole[],
): Promise<void> {
  if (tx.location !== "server") {
    return;
  }
  const membership = await findMembership(tx, ctx, workspaceId);
  if (!membership) {
    throw mutationError("forbidden", "You are not a member of this workspace.");
  }
  assertRole(membership.role, roles);
}

/**
 * Reads the workspace of an existing row from the database, never from the
 * mutator's arguments, and checks membership in it. This stops a mutator from
 * changing a row in another workspace. A row in a workspace the user cannot
 * see is reported as missing, so its existence does not leak.
 *
 * Returns the row's workspace ID on the server and `undefined` on the client.
 */
export async function assertMemberOfRow(
  tx: Tx,
  ctx: ZeroContext,
  table: WorkspaceTable,
  id: string,
  roles?: readonly WorkspaceRole[],
): Promise<string | undefined> {
  if (tx.location !== "server") {
    return undefined;
  }
  // Every workspace table has `id` and `workspaceId`, but TypeScript cannot
  // follow them through the generic table name.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const query = zql[table as "issue"];
  const row = await tx.run(query.where("id", id).one());
  if (!row) {
    throw notFound();
  }
  const membership = await findMembership(tx, ctx, row.workspaceId);
  if (!membership) {
    throw notFound();
  }
  assertRole(membership.role, roles);
  return row.workspaceId;
}

function findMembership(tx: Tx, ctx: ZeroContext, workspaceId: string) {
  return tx.run(
    zql.workspaceMember.where("workspaceId", workspaceId).where("userId", ctx.userID).one(),
  );
}

function assertRole(role: string, roles: readonly WorkspaceRole[] | undefined) {
  if (roles && !roles.some((allowed) => allowed === role)) {
    throw mutationError("forbidden", "You do not have permission to do this.");
  }
}

function notFound() {
  return mutationError("not_found", "This item does not exist or you cannot access it.");
}
