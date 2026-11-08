import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

import { assertMember, assertMemberOfRow, notFound } from "../auth";
import { zql } from "../schema.gen";
import { assertNewId, color, definedOnly, invalid, isServer, name, type Tx } from "./shared";

export const createLabelArgs = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  /** Null for a workspace label. */
  teamId: z.uuid().nullable(),
  name,
  color,
});

export const updateLabelArgs = z.object({
  id: z.uuid(),
  name: name.optional(),
  color: color.optional(),
});

// Escapes LIKE wildcards, so ILIKE compares the name literally, ignoring case.
function exactPattern(text: string) {
  return text.replaceAll(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Label names are unique within their scope, ignoring case. Partial unique
 * indexes on `lower(name)` are the final guard; this check gives a clear
 * message instead of a database error.
 */
async function assertNameFree(
  tx: Tx,
  label: { id: string; workspaceId: string; teamId: string | null; name: string },
) {
  const scope = zql.label.where("workspaceId", label.workspaceId);
  const sameName = await tx.run(
    (label.teamId ? scope.where("teamId", label.teamId) : scope.where("teamId", "IS", null))
      .where("name", "ILIKE", exactPattern(label.name))
      .where("id", "!=", label.id)
      .one(),
  );
  if (sameName) {
    throw invalid("A label with this name already exists.");
  }
}

// Every member can manage labels (decision record 0006).
export const labelMutators = {
  create: defineMutator(createLabelArgs, async ({ args, ctx, tx }) => {
    await assertMember(tx, ctx, args.workspaceId);
    if (isServer(tx)) {
      await assertNewId(tx, "label", args.id);
      if (args.teamId) {
        const team = await tx.run(zql.team.where("id", args.teamId).one());
        if (team?.workspaceId !== args.workspaceId) {
          throw notFound();
        }
      }
      await assertNameFree(tx, args);
    }
    const now = Date.now();
    await tx.mutate.label.insert({ ...args, createdAt: now, updatedAt: now });
  }),

  update: defineMutator(updateLabelArgs, async ({ args, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "label", args.id);
    const label = await tx.run(zql.label.where("id", args.id).one());
    if (isServer(tx) && label && args.name) {
      await assertNameFree(tx, { ...label, name: args.name });
    }
    await tx.mutate.label.update({
      ...definedOnly({ name: args.name, color: args.color }),
      id: args.id,
      updatedAt: Date.now(),
    });
  }),

  /** Deletes the label and removes it from every issue. */
  delete: defineMutator(z.object({ id: z.uuid() }), async ({ args: { id }, ctx, tx }) => {
    await assertMemberOfRow(tx, ctx, "label", id);
    for (const issueLabel of await tx.run(zql.issueLabel.where("labelId", id))) {
      await tx.mutate.issueLabel.delete({ issueId: issueLabel.issueId, labelId: id });
    }
    await tx.mutate.label.delete({ id });
  }),
};
