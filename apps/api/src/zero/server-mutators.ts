import {
  defineCreateIssue,
  defineMoveIssueToTeam,
  type IssueNumberAllocator,
  mutators,
  notFound,
} from "@curved/zero";
import { defineMutators } from "@rocicorp/zero";

/**
 * Allocates the next issue number of a team in the mutation's transaction
 * (decision record 0006). `UPDATE ... RETURNING` locks the team's row until
 * the transaction ends, so issue creation in one team runs one at a time and
 * other teams are not affected. Numbers are never reused, even after deletion.
 */
export const allocateIssueNumber: IssueNumberAllocator = async (tx, teamId) => {
  if (tx.location !== "server") {
    throw new Error("Issue numbers are allocated on the server only");
  }
  const rows = await tx.dbTransaction.query(
    `update "team" set "next_issue_number" = "next_issue_number" + 1
     where "id" = $1 returning "next_issue_number" - 1 as "number"`,
    [teamId],
  );
  const [row] = [...rows];
  const number: unknown = row?.["number"];
  if (typeof number !== "number") {
    throw notFound();
  }
  return number;
};

/**
 * The mutators the API runs. They extend the shared ones in @curved/zero with
 * server-only logic, which never reaches the browser bundle.
 */
export const serverMutators = defineMutators(mutators, {
  issues: {
    create: defineCreateIssue(allocateIssueNumber),
    moveToTeam: defineMoveIssueToTeam(allocateIssueNumber),
  },
});
