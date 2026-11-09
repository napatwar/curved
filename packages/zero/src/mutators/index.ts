import { defineMutators } from "@rocicorp/zero";

import { commentMutators } from "./comments";
import { issueMutators } from "./issues";
import { labelMutators } from "./labels";
import { teamMutators, workflowStateMutators } from "./teams";

// Register every domain here, in one top-level defineMutators call. The API
// extends these with server-only versions in apps/api/src/zero/server-mutators.ts.
export const mutators = defineMutators({
  comments: commentMutators,
  issues: issueMutators,
  labels: labelMutators,
  teams: teamMutators,
  workflowStates: workflowStateMutators,
});
