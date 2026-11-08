import type { Query } from "@rocicorp/zero";

import type { Schema } from "../schema.gen";

// Archive and trash filters for issues (decision record 0006). Every issue
// query uses exactly one of them, next to `whereMember` from ./membership.ts.
// Only issues are archived or trashed.

type IssueQuery<TReturn> = Query<"issue", Schema, TReturn>;

/** Issues that are neither archived nor in the Trash: every list and view. */
export function whereActive<TReturn>(query: IssueQuery<TReturn>): IssueQuery<TReturn> {
  return query.where("archivedAt", "IS", null).where("deletedAt", "IS", null);
}

/** Archived issues that are not in the Trash, for the "Show archived" filter. */
export function whereArchived<TReturn>(query: IssueQuery<TReturn>): IssueQuery<TReturn> {
  return query.where("archivedAt", "IS NOT", null).where("deletedAt", "IS", null);
}

/** Issues in the Trash, archived or not, for the Trash page. */
export function whereTrashed<TReturn>(query: IssueQuery<TReturn>): IssueQuery<TReturn> {
  return query.where("deletedAt", "IS NOT", null);
}
