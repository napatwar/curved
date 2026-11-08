import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import { issue, workspaceMember } from "@curved/db/schema";
import { queries, type Schema, type ZeroContext } from "@curved/zero";
import type { Query } from "@rocicorp/zero";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { testDatabaseUrl } from "../../../../test/database";
import { addMember, createUser, createWorkspace, resetDatabase } from "../../../../test/fixtures";
import { createDbProvider } from "./db-provider";

const db = createDb(testDatabaseUrl);
const dbProvider = createDbProvider(db);

// Runs a query the way zero-cache does after the API has transformed it:
// against Postgres, with the membership filter included.
function run<TTable extends keyof Schema["tables"], TReturn>(
  query: Query<TTable, Schema, TReturn>,
) {
  return dbProvider.transaction((tx) => tx.run(query));
}

async function insertIssue(workspaceId: string, title: string) {
  const now = new Date();
  await db
    .insert(issue)
    .values({ id: uuidv7(), workspaceId, title, status: "todo", createdAt: now, updatedAt: now });
}

let member: ZeroContext;
let outsider: ZeroContext;
let workspaceId: string;
let otherWorkspaceId: string;

beforeEach(async () => {
  await resetDatabase(db);
  member = { userID: await createUser(db, "Member") };
  outsider = { userID: await createUser(db, "Outsider") };
  workspaceId = await createWorkspace(db, "acme");
  otherWorkspaceId = await createWorkspace(db, "other");
  await addMember(db, workspaceId, member.userID);
  await addMember(db, otherWorkspaceId, outsider.userID);
  await insertIssue(workspaceId, "Acme issue");
  await insertIssue(otherWorkspaceId, "Other issue");
});

afterAll(async () => {
  await db.$client.end();
});

describe("membership filter on queries", () => {
  it("returns a workspace's issues to its members", async () => {
    const rows = await run(queries.issues.byWorkspace.fn({ args: { workspaceId }, ctx: member }));
    expect(rows.map((row) => row.title)).toEqual(["Acme issue"]);
  });

  it("returns nothing to a user outside the workspace, even with its ID", async () => {
    const byWorkspace = await run(
      queries.issues.byWorkspace.fn({ args: { workspaceId }, ctx: outsider }),
    );
    const byFilter = await run(
      queries.issues.byFilter.fn({ args: { workspaceId, limit: 100 }, ctx: outsider }),
    );
    const members = await run(
      queries.workspaceMembers.byWorkspace.fn({ args: { workspaceId }, ctx: outsider }),
    );

    expect(byWorkspace).toEqual([]);
    expect(byFilter).toEqual([]);
    expect(members).toEqual([]);
  });

  it("stops returning a workspace's data once the member is removed", async () => {
    const issuesQuery = queries.issues.byWorkspace.fn({ args: { workspaceId }, ctx: member });
    const workspacesQuery = queries.workspaces.mine.fn({ args: undefined, ctx: member });
    expect(await run(issuesQuery)).toHaveLength(1);
    expect(await run(workspacesQuery)).toHaveLength(1);

    await db.delete(workspaceMember).where(eq(workspaceMember.userId, member.userID));

    expect(await run(issuesQuery)).toEqual([]);
    expect(await run(workspacesQuery)).toEqual([]);
  });

  it("lists only the user's own workspaces", async () => {
    const rows = await run(queries.workspaces.mine.fn({ args: undefined, ctx: member }));
    expect(rows.map((row) => row.slug)).toEqual(["acme"]);
  });

  it("shows other users only when they share a workspace", async () => {
    const before = await run(queries.users.visible.fn({ args: undefined, ctx: member }));
    expect(before.map((row) => row.name)).toEqual(["Member"]);

    await addMember(db, workspaceId, outsider.userID);

    const after = await run(queries.users.visible.fn({ args: undefined, ctx: member }));
    expect(after.map((row) => row.name).toSorted()).toEqual(["Member", "Outsider"]);
  });
});
