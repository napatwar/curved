import { defineMutators } from "@rocicorp/zero";

import { issueMutators } from "./issues";

// Register every domain here, in one top-level defineMutators call.
export const mutators = defineMutators({
  issues: issueMutators,
});
