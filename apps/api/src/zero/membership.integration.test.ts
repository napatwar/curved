import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import { issueKeyAlias, workspaceMember } from "@curved/db/schema";
import { queries, type Schema, type ZeroContext } from "@curved/zero";
import type { Query } from "@rocicorp/zero";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { testDatabaseUrl } from "../../../../test/database";
import {
  addMember,
  createUser,
  createWorkspace,
  firstTeam,
  insertIssue,
  resetDatabase,
} from "../../../../test/fixtures";
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
  await insertIssue(db, workspaceId, { title: "Acme issue" });
  await insertIssue(db, otherWorkspaceId, { title: "Other issue" });
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
    const teams = await run(queries.teams.byWorkspace.fn({ args: { workspaceId }, ctx: outsider }));
    const labels = await run(
      queries.labels.byWorkspace.fn({ args: { workspaceId }, ctx: outsider }),
    );
    const byKey = await run(
      queries.issues.byKey.fn({ args: { workspaceId, teamKey: "TEAM", number: 1 }, ctx: outsider }),
    );

    expect(byWorkspace).toEqual([]);
    expect(byFilter).toEqual([]);
    expect(members).toEqual([]);
    expect(teams).toEqual([]);
    expect(labels).toEqual([]);
    expect(byKey).toBeUndefined();
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

function ids(rows: readonly { id: string }[]) {
  return rows.map((row) => row.id);
}

describe("archive and trash filter on queries", () => {
  let active: string;
  let archived: string;
  let trashed: string;

  beforeEach(async () => {
    await resetDatabase(db);
    member = { userID: await createUser(db, "Member") };
    workspaceId = await createWorkspace(db, "acme");
    await addMember(db, workspaceId, member.userID);
    active = await insertIssue(db, workspaceId, { title: "Active", assigneeId: member.userID });
    archived = await insertIssue(db, workspaceId, {
      title: "Archived",
      assigneeId: member.userID,
      archivedAt: new Date(),
    });
    trashed = await insertIssue(db, workspaceId, {
      title: "Trashed",
      assigneeId: member.userID,
      archivedAt: new Date(),
      deletedAt: new Date(),
    });
  });

  it("leaves archived and trashed issues out of every list", async () => {
    const { id: teamId } = await firstTeam(db, workspaceId);
    const args = { workspaceId };

    expect(ids(await run(queries.issues.byWorkspace.fn({ args, ctx: member })))).toEqual([active]);
    expect(
      ids(await run(queries.issues.byTeam.fn({ args: { workspaceId, teamId }, ctx: member }))),
    ).toEqual([active]);
    expect(ids(await run(queries.issues.mine.fn({ args, ctx: member })))).toEqual([active]);
    expect(
      ids(
        await run(queries.issues.byFilter.fn({ args: { workspaceId, limit: 100 }, ctx: member })),
      ),
    ).toEqual([active]);
  });

  it("lists archived issues and the Trash separately", async () => {
    const args = { workspaceId };

    expect(ids(await run(queries.issues.archived.fn({ args, ctx: member })))).toEqual([archived]);
    expect(ids(await run(queries.issues.trashed.fn({ args, ctx: member })))).toEqual([trashed]);
  });

  it("still opens an archived or trashed issue by ID and by key", async () => {
    const byId = await run(queries.issues.byId.fn({ args: { id: archived }, ctx: member }));
    const byKey = await run(
      queries.issues.byKey.fn({ args: { workspaceId, teamKey: "TEAM", number: 3 }, ctx: member }),
    );

    expect(byId?.title).toBe("Archived");
    expect(byKey?.title).toBe("Trashed");
  });

  it("finds an issue by an old key after it moved", async () => {
    const { id: teamId } = await firstTeam(db, workspaceId);
    await db.insert(issueKeyAlias).values({
      id: uuidv7(),
      workspaceId,
      teamId,
      number: 99,
      issueId: active,
      createdAt: new Date(),
    });

    const alias = await run(
      queries.issueKeyAliases.byKey.fn({
        args: { workspaceId, teamKey: "TEAM", number: 99 },
        ctx: member,
      }),
    );

    expect(alias?.issue?.title).toBe("Active");
  });
});
