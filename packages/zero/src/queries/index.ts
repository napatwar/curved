import { defineQueries } from "@rocicorp/zero";

import { issueQueries } from "./issues";

// Register every domain here. Zero requires one top-level defineQueries call.
export const queries = defineQueries({
  issues: issueQueries,
});
