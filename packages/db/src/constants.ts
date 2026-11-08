export const issueStatuses = ["todo", "in_progress", "done"] as const;

export type IssueStatus = (typeof issueStatuses)[number];
