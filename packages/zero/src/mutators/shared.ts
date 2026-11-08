import type { Transaction } from "@rocicorp/zero";
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";

import { mutationError, notFound } from "../auth";
import { type Issue, zql } from "../schema.gen";

export type Tx = Transaction;

const DAY_MS = 86_400_000;

export const name = z.string().trim().min(1).max(100);

/** `#rrggbb`. */
export const color = z.string().regex(/^#[0-9a-f]{6}$/i);

export const priority = z.number().int().min(0).max(4);

/**
 * A due date is a calendar date, sent as milliseconds at UTC midnight, which
 * is how Zero exposes a Postgres `date`. Anything else would shift by a day
 * in some time zones.
 */
export const dueDate = z
  .number()
  .int()
  .refine((ms) => ms % DAY_MS === 0, "A due date must be a date at UTC midnight.");

/** A key from the `fractional-indexing` package. */
export const sortOrder = z.string().min(2).max(200).refine(isSortKey, "Not a valid sort key.");

function isSortKey(key: string) {
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

export function invalid(message: string) {
  return mutationError("invalid", message);
}

/**
 * True when the mutator runs on the server. Checks that read other rows run
 * only there: a client may not have synced those rows, and the server result
 * always wins (decision record 0005).
 */
export function isServer(tx: Tx) {
  return tx.location === "server";
}

type TableWithId = "comment" | "issue" | "issueKeyAlias" | "label" | "team" | "workflowState";

/**
 * Zero's server insert ignores a primary key conflict. A mutator that inserts
 * rows which point at a new row must check first that the ID is new, or the
 * dependent rows would attach to someone else's row.
 */
export async function assertNewId(tx: Tx, table: TableWithId, id: string) {
  if (!isServer(tx)) {
    return;
  }
  // Every table here has an `id`, but TypeScript cannot follow it through
  // the generic table name.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const existing = await tx.run(zql[table as "issue"].where("id", id).one());
  if (existing) {
    throw invalid("This ID is already in use.");
  }
}

/** Checks that a user is a member of the workspace, such as a new assignee. */
export async function assertWorkspaceMember(tx: Tx, workspaceId: string, userId: string) {
  const member = await tx.run(
    zql.workspaceMember.where("workspaceId", workspaceId).where("userId", userId).one(),
  );
  if (!member) {
    throw invalid("The assignee is not a member of this workspace.");
  }
}

/** Checks that a state belongs to the team and returns it. */
export async function assertTeamState(tx: Tx, stateId: string, teamId: string) {
  const state = await tx.run(zql.workflowState.where("id", stateId).one());
  if (state?.teamId !== teamId) {
    throw invalid("The state does not belong to the issue's team.");
  }
  return state;
}

/**
 * Checks that labels can go on an issue: each belongs to the workspace, and a
 * team label belongs to the issue's team.
 */
export async function assertLabelsFit(
  tx: Tx,
  labelIds: readonly string[],
  workspaceId: string,
  teamId: string,
) {
  for (const labelId of labelIds) {
    const label = await tx.run(zql.label.where("id", labelId).one());
    if (label?.workspaceId !== workspaceId || (label.teamId && label.teamId !== teamId)) {
      throw invalid("A label does not belong to the issue's workspace or team.");
    }
  }
}

/**
 * Checks that `parentId` can be the parent of `issueId`: it is in the same
 * workspace, and `issueId` is not among its ancestors. Depth is not limited
 * (decision record 0006).
 */
export async function assertParentFits(
  tx: Tx,
  parentId: string,
  workspaceId: string,
  issueId: string,
) {
  const seen = new Set<string>();
  let currentId: string | null | undefined = parentId;
  while (currentId) {
    if (currentId === issueId) {
      throw invalid("An issue cannot be a sub-issue of itself or of its own sub-issues.");
    }
    if (seen.has(currentId)) {
      break;
    }
    seen.add(currentId);
    const current: Issue | undefined = await tx.run(zql.issue.where("id", currentId).one());
    if (current?.workspaceId !== workspaceId) {
      throw notFound();
    }
    currentId = current.parentId;
  }
}

/**
 * A sort key before the team's first issue, so a new issue goes to the top.
 * The client reads the issues it has synced; the server reads the team's real
 * lowest key through `issue_team_sort_order_idx`, and its key wins.
 */
export async function keyBeforeFirst(tx: Tx, teamId: string) {
  const first = await tx.run(
    zql.issue.where("teamId", teamId).orderBy("sortOrder", "asc").orderBy("id", "asc").one(),
  );
  return generateKeyBetween(null, first?.sortOrder ?? null);
}

/** Copies only the keys whose value is not `undefined`. */
export function definedOnly<T extends Record<string, unknown>>(values: T): Partial<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
