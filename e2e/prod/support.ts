import { fileURLToPath } from "node:url";

/**
 * The signed-in admin's cookies, written by global-setup.ts. It is outside
 * test-results/, which Playwright empties at the start of a run.
 */
export const adminStatePath = fileURLToPath(new URL(".auth/admin.json", import.meta.url));

export const e2eWorkspaceSlug = "e2e";
