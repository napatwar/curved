export const issueStatuses = ['todo', 'in_progress', 'done'] as const

export type IssueStatus = (typeof issueStatuses)[number]

/** Fixed workspace used until authentication and real workspaces exist. */
export const DEV_WORKSPACE_ID = '00000000-0000-7000-8000-000000000001'
