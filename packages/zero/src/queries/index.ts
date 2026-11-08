import { defineQueries } from "@rocicorp/zero";

import { issueQueries } from "./issues";
import { userQueries, workspaceMemberQueries, workspaceQueries } from "./workspaces";

// Register every domain here. Zero requires one top-level defineQueries call.
// Every query must limit rows to the signed-in user's workspaces with the
// helpers in ../auth (decision record 0005).
export const queries = defineQueries({
  issues: issueQueries,
  users: userQueries,
  workspaceMembers: workspaceMemberQueries,
  workspaces: workspaceQueries,
});
