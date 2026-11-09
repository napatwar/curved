import type { Db } from "@curved/db";
import { eq, sql } from "@curved/db/orm";
import { issue, team, user, workspace, workspaceMember } from "@curved/db/schema";
import { createTeam } from "@curved/db/teams";
import { v7 as uuidv7 } from "uuid";

/** Removes every row the tests create. Tests share one database. */
export async function resetDatabase(db: Db) {
  await db.execute(
    `truncate table "issue_label", "label", "issue_key_alias", "issue_description", "comment", "issue", "workflow_state", "team", "workspace_invitation", "workspace_member", "workspace", "verification", "session", "account", "user" cascade`,
  );
}

export async function createUser(db: Db, name = "Test User") {
  const id = uuidv7();
  const now = new Date();
  await db.insert(user).values({
    id,
    name,
    email: `${id}@example.com`,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Creates a workspace and, like the API, its first team. */
export async function createWorkspace(db: Db, slug = `ws-${uuidv7().slice(-12)}`) {
  const id = uuidv7();
  await db.insert(workspace).values({ id, name: slug, slug, createdAt: new Date() });
  await createTeam(db, { workspaceId: id, key: "TEAM", name: slug });
  return id;
}

/** The workspace's first team and its states, keyed by category. */
export async function firstTeam(db: Db, workspaceId: string) {
  const row = await db.query.team.findFirst({
    where: eq(team.workspaceId, workspaceId),
    orderBy: team.createdAt,
    with: { states: true },
  });
  if (!row) {
    throw new Error(`Workspace ${workspaceId} has no team`);
  }
  const stateOf = (category: string) => {
    const state = row.states.find((candidate) => candidate.category === category);
    if (!state) {
      throw new Error(`No ${category} state`);
    }
    return state.id;
  };
  return { ...row, stateOf };
}

export async function addMember(
  db: Db,
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member" = "member",
) {
  const id = uuidv7();
  await db.insert(workspaceMember).values({ id, workspaceId, userId, role, createdAt: new Date() });
  return id;
}

/**
 * Inserts an issue straight into Postgres, in the workspace's first team,
 * with the next number and the default state unless given.
 */
export async function insertIssue(
  db: Db,
  workspaceId: string,
  values: Partial<typeof issue.$inferInsert> = {},
) {
  const { id: teamId, defaultStateId } = await firstTeam(db, workspaceId);
  const [allocated] = await db
    .update(team)
    .set({ nextIssueNumber: sql`${team.nextIssueNumber} + 1` })
    .where(eq(team.id, teamId))
    .returning({ number: sql<number>`${team.nextIssueNumber} - 1` });
  const id = uuidv7();
  const now = new Date();
  await db.insert(issue).values({
    id,
    workspaceId,
    teamId,
    number: allocated?.number ?? 1,
    title: "Test issue",
    stateId: defaultStateId,
    priority: 0,
    // Equal keys are valid; `id` breaks ties (decision record 0006).
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
    ...values,
  });
  return id;
}
