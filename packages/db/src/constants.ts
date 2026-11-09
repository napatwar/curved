// Values shared by the database, Zero mutators and the web app
// (decision record 0006).

/** Fixed categories of workflow states. App logic uses these, never state names. */
export const workflowStateCategories = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;

export type WorkflowStateCategory = (typeof workflowStateCategories)[number];

/**
 * The states every new team gets, one per category. The migration that added
 * teams (0006_domain_model.sql) repeats them in SQL for existing workspaces.
 */
export const defaultWorkflowStates = [
  { name: "Backlog", category: "backlog", color: "#bec2c8" },
  { name: "Todo", category: "unstarted", color: "#e2e2e2" },
  { name: "In Progress", category: "started", color: "#f2c94c" },
  { name: "Done", category: "completed", color: "#5e6ad2" },
  { name: "Canceled", category: "canceled", color: "#95a2b3" },
] as const satisfies readonly {
  name: string;
  category: WorkflowStateCategory;
  color: string;
}[];

/** New issues start in this category's state unless the team sets another. */
export const defaultIssueCategory: WorkflowStateCategory = "unstarted";

/**
 * Issue priority. Sorting descending gives urgent first and none last. Linear
 * uses 1 for urgent and 4 for low; the public API and importers map between them.
 */
export const issuePriorities = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 } as const;

export type IssuePriority = (typeof issuePriorities)[keyof typeof issuePriorities];

/** 1 to 7 uppercase ASCII letters or digits, starting with a letter. */
export const teamKeyPattern = /^[A-Z][A-Z0-9]{0,6}$/;

/**
 * The key of a workspace's first team, from its slug: the first three ASCII
 * letters or digits, uppercased, after any leading digits. The migration that
 * added teams uses the same rule in SQL.
 */
export function teamKeyFromSlug(slug: string): string {
  const key = slug
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, 3);
  return key || "TEAM";
}

/** Zod limits on Markdown text (decision record 0006). */
export const markdownLimits = { description: 100_000, comment: 20_000 } as const;

/** The issue number a client inserts while the server has not assigned one. */
export const pendingIssueNumber = 0;
