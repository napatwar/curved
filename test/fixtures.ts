import type { Db } from "@curved/db";
import { user, workspace, workspaceMember } from "@curved/db/schema";
import { v7 as uuidv7 } from "uuid";

/** Removes every row the tests create. Tests share one database. */
export async function resetDatabase(db: Db) {
  await db.execute(
    `truncate table "comment", "issue", "workspace_invitation", "workspace_member", "workspace", "verification", "session", "account", "user" cascade`,
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

export async function createWorkspace(db: Db, slug = `ws-${uuidv7().slice(-12)}`) {
  const id = uuidv7();
  await db.insert(workspace).values({ id, name: slug, slug, createdAt: new Date() });
  return id;
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
