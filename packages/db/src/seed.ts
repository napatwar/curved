// Creates the development instance admin, their workspace, its first team and
// a first issue. It is safe to run again: existing rows are left alone.
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

import {
  DEV_TEAM_ID,
  DEV_TEAM_KEY,
  DEV_USER_EMAIL,
  DEV_USER_ID,
  DEV_USER_PASSWORD,
  DEV_WORKSPACE_ID,
  DEV_WORKSPACE_SLUG,
} from "./dev";
import { createDb } from "./index";
import { account, issue, issueDescription, team, user, workspace, workspaceMember } from "./schema";
import { createTeam } from "./teams";

const WELCOME_ISSUE_ID = "00000000-0000-7000-8000-000000000101";

const welcomeDescription = `Curved is an open-source task manager.

- Press **Add** to create an issue.
- Mark an issue **Done** when it is finished.
`;

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

  const [existingTeam] = await tx
    .select()
    .from(team)
    .where(eq(team.workspaceId, DEV_WORKSPACE_ID))
    .orderBy(team.createdAt)
    .limit(1);
  const teamId =
    existingTeam?.id ??
    (
      await createTeam(tx, {
        id: DEV_TEAM_ID,
        workspaceId: DEV_WORKSPACE_ID,
        key: DEV_TEAM_KEY,
        name: "Curved",
      })
    ).teamId;

  const [welcome] = await tx.select().from(issue).where(eq(issue.id, WELCOME_ISSUE_ID));
  if (!welcome) {
    // Allocates the number the way the server mutator does.
    const [allocated] = await tx
      .update(team)
      .set({ nextIssueNumber: sql`${team.nextIssueNumber} + 1` })
      .where(eq(team.id, teamId))
      .returning({
        number: sql<number>`${team.nextIssueNumber} - 1`,
        stateId: team.defaultStateId,
      });
    if (!allocated) {
      throw new Error("The development team is missing");
    }
    const [first] = await tx
      .select({ sortOrder: issue.sortOrder })
      .from(issue)
      .where(eq(issue.teamId, teamId))
      .orderBy(issue.sortOrder, issue.id)
      .limit(1);
    await tx.insert(issue).values({
      id: WELCOME_ISSUE_ID,
      workspaceId: DEV_WORKSPACE_ID,
      teamId,
      number: allocated.number,
      title: "Welcome to Curved",
      stateId: allocated.stateId,
      priority: 0,
      creatorId: DEV_USER_ID,
      sortOrder: generateKeyBetween(null, first?.sortOrder ?? null),
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(issueDescription).values({
      issueId: WELCOME_ISSUE_ID,
      workspaceId: DEV_WORKSPACE_ID,
      body: welcomeDescription,
      createdAt: now,
      updatedAt: now,
    });
  }
});

console.log(
  `Seeded ${DEV_USER_EMAIL} (password: ${DEV_USER_PASSWORD}) in workspace /${DEV_WORKSPACE_SLUG}`,
);

await db.$client.end();
