// Fixed records that `pnpm db:seed` creates for local development and
// end-to-end tests. Never use them in production.

export const DEV_WORKSPACE_ID = "00000000-0000-7000-8000-000000000001";
export const DEV_WORKSPACE_SLUG = "curved";

export const DEV_USER_ID = "00000000-0000-7000-8000-000000000011";
export const DEV_USER_EMAIL = "dev@example.com";
export const DEV_USER_PASSWORD = "curved-dev-password";

// The workspace's first team. Migration 0006 gives an existing development
// workspace a team with a random ID, so look the team up by workspace rather
// than by this ID.
export const DEV_TEAM_ID = "00000000-0000-7000-8000-000000000021";
export const DEV_TEAM_KEY = "CUR";
