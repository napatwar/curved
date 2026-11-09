import { markdownLimits } from "@curved/db/constants";
import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

import { assertMemberOfRow, mutationError } from "../auth";
import type { ZeroContext } from "../context";
import { zql } from "../schema.gen";
import type { Tx } from "./shared";

const body = z
  .string()
  .max(markdownLimits.comment)
  .refine((text) => text.trim().length > 0, "A comment cannot be empty.");

export const createCommentArgs = z.object({ id: z.uuid(), issueId: z.uuid(), body });
export const editCommentArgs = z.object({ id: z.uuid(), body });

/** Authors can edit and delete only their own comments (decision record 0006). */
async function assertAuthor(tx: Tx, ctx: ZeroContext, id: string) {
  await assertMemberOfRow(tx, ctx, "comment", id);
  const comment = await tx.run(zql.comment.where("id", id).one());
  if (comment && comment.authorId !== ctx.userID) {
    throw mutationError("forbidden", "You can only change your own comments.");
  }
  return comment;
}

export const commentMutators = {
  create: defineMutator(createCommentArgs, async ({ args, ctx, tx }) => {
    const workspaceId =
      (await assertMemberOfRow(tx, ctx, "issue", args.issueId)) ??
      (await tx.run(zql.issue.where("id", args.issueId).one()))?.workspaceId;
    if (!workspaceId) {
      // The client has not synced the issue. The server will save it.
      return;
    }
    const now = Date.now();
    await tx.mutate.comment.insert({
      id: args.id,
      workspaceId,
      issueId: args.issueId,
      authorId: ctx.userID,
      body: args.body,
      editedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }),

  edit: defineMutator(editCommentArgs, async ({ args: { id, body: text }, ctx, tx }) => {
    await assertAuthor(tx, ctx, id);
    const now = Date.now();
    await tx.mutate.comment.update({ id, body: text, editedAt: now, updatedAt: now });
  }),

  delete: defineMutator(z.object({ id: z.uuid() }), async ({ args: { id }, ctx, tx }) => {
    await assertAuthor(tx, ctx, id);
    await tx.mutate.comment.delete({ id });
  }),
};
