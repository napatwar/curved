import { pendingIssueNumber } from "@curved/db/constants";

/**
 * An issue's key, such as `ENG-123`. While the server has not assigned the
 * number, it shows `ENG-…` (decision record 0006).
 */
export function issueKey(teamKey: string | undefined, number: number) {
  return `${teamKey ?? ""}-${number === pendingIssueNumber ? "…" : number}`;
}
