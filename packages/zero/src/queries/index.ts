import { defineQueries } from "@rocicorp/zero";

import { issueKeyAliasQueries, issueQueries } from "./issues";
import { labelQueries, teamQueries } from "./teams";
import { userQueries, workspaceMemberQueries, workspaceQueries } from "./workspaces";

// Register every domain here. Zero requires one top-level defineQueries call.
// Every query must limit rows to the signed-in user's workspaces with the
// helpers in ../auth (decision record 0005). Every issue list must also use
// one of the archive and trash filters there; only opening one issue by its
// ID or key skips them, because archived issues still open (decision record 0006).
export const queries = defineQueries({
  issueKeyAliases: issueKeyAliasQueries,
  issues: issueQueries,
  labels: labelQueries,
  teams: teamQueries,
  users: userQueries,
  workspaceMembers: workspaceMemberQueries,
  workspaces: workspaceQueries,
});
