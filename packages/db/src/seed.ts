// Creates the development instance admin, their workspace and a first issue.
// It is safe to run again: existing rows are left alone.
import { hashPassword } from "better-auth/crypto";

import {
  DEV_USER_EMAIL,
  DEV_USER_ID,
  DEV_USER_PASSWORD,
  DEV_WORKSPACE_ID,
  DEV_WORKSPACE_SLUG,
} from "./dev";
import { createDb } from "./index";
import { account, issue, user, workspace, workspaceMember } from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const db = createDb(connectionString);
const now = new Date();

await db.transaction(async (tx) => {
  await tx
    .insert(user)
    .values({
      id: DEV_USER_ID,
      name: "Dev User",
      email: DEV_USER_EMAIL,
      emailVerified: true,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // Better Auth stores email and password sign-in as a `credential` account.
  await tx
    .insert(account)
    .values({
      id: "00000000-0000-7000-8000-000000000012",
      accountId: DEV_USER_ID,
      providerId: "credential",
      userId: DEV_USER_ID,
      password: await hashPassword(DEV_USER_PASSWORD),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await tx
    .insert(workspace)
    .values({ id: DEV_WORKSPACE_ID, name: "Curved", slug: DEV_WORKSPACE_SLUG, createdAt: now })
    .onConflictDoNothing();

  await tx
    .insert(workspaceMember)
    .values({
      id: "00000000-0000-7000-8000-000000000013",
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      role: "owner",
      createdAt: now,
    })
    .onConflictDoNothing();

  await tx
    .insert(issue)
    .values({
      id: "00000000-0000-7000-8000-000000000101",
      workspaceId: DEV_WORKSPACE_ID,
      title: "Welcome to Curved",
      status: "todo",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
});

console.log(
  `Seeded ${DEV_USER_EMAIL} (password: ${DEV_USER_PASSWORD}) in workspace /${DEV_WORKSPACE_SLUG}`,
);

await db.$client.end();
