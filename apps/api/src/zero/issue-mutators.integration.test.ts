import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import {
  comment,
  issue,
  issueDescription,
  issueKeyAlias,
  issueLabel,
  label,
  team,
} from "@curved/db/schema";
import { createTeam } from "@curved/db/teams";
import { mutators, type ZeroContext, zql } from "@curved/zero";
import { ApplicationError } from "@rocicorp/zero";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
import { runMutator } from "./endpoints";
import { rejectedWith, serverMutate } from "./test-helpers";

const db = createDb(testDatabaseUrl);
const dbProvider = createDbProvider(db);
const mutate = serverMutate(dbProvider);

let member: ZeroContext;
let admin: ZeroContext;
let outsider: ZeroContext;
let workspaceId: string;
let teamId: string;
let stateOf: (category: string) => string;
let outsiderWorkspaceId: string;

beforeEach(async () => {
  await resetDatabase(db);
  member = { userID: await createUser(db, "Member") };
  admin = { userID: await createUser(db, "Admin") };
  outsider = { userID: await createUser(db, "Outsider") };
  workspaceId = await createWorkspace(db);
  await addMember(db, workspaceId, member.userID);
  await addMember(db, workspaceId, admin.userID, "admin");
  ({ id: teamId, stateOf } = await firstTeam(db, workspaceId));
  outsiderWorkspaceId = await createWorkspace(db);
  await addMember(db, outsiderWorkspaceId, outsider.userID);
});

afterAll(async () => {
  await db.$client.end();
});

async function createIssue(ctx: ZeroContext, values: Record<string, unknown> = {}) {
  const id = uuidv7();
  await mutate(ctx, "issues.create", { id, workspaceId, teamId, title: "An issue", ...values });
  return id;
}

async function findIssue(id: string) {
  const [row] = await db.select().from(issue).where(eq(issue.id, id));
  return row;
}

async function createLabel(teamIdOrNull: string | null, name = "Bug") {
  const id = uuidv7();
  await mutate(member, "labels.create", {
    id,
    workspaceId,
    teamId: teamIdOrNull,
    name,
    color: "#ff0000",
  });
  return id;
}

describe("issues.create on the server", () => {
  it("numbers issues in the team from 1 and never reuses a number", async () => {
    const first = await createIssue(member);
    const second = await createIssue(member);
    await db.delete(issue).where(eq(issue.id, second));
    const third = await createIssue(member);

    expect((await findIssue(first))?.number).toBe(1);
    expect((await findIssue(third))?.number).toBe(3);
    const [row] = await db.select().from(team).where(eq(team.id, teamId));
    expect(row?.nextIssueNumber).toBe(4);
  });

  it("uses the team's default state, sets the creator, and saves the description", async () => {
    const id = await createIssue(member, { description: "# Steps\n\n1. Open it" });

    expect(await findIssue(id)).toMatchObject({
      stateId: stateOf("unstarted"),
      creatorId: member.userID,
      priority: 0,
      archivedAt: null,
      deletedAt: null,
    });
    const [description] = await db
      .select()
      .from(issueDescription)
      .where(eq(issueDescription.issueId, id));
    expect(description).toMatchObject({ workspaceId, body: "# Steps\n\n1. Open it" });
  });

  it("puts each new issue before the team's first one", async () => {
    const first = await createIssue(member);
    const second = await createIssue(member);

    const secondKey = (await findIssue(second))?.sortOrder ?? "";
    const firstKey = (await findIssue(first))?.sortOrder ?? "";
    expect(secondKey < firstKey).toBe(true);
  });

  it("adds labels that belong to the workspace or the team", async () => {
    const workspaceLabel = await createLabel(null, "Bug");
    const teamLabel = await createLabel(teamId, "Backend");

    const id = await createIssue(member, { labelIds: [workspaceLabel, teamLabel] });

    const labels = await db.select().from(issueLabel).where(eq(issueLabel.issueId, id));
    expect(labels.map((row) => row.labelId).toSorted()).toEqual(
      [workspaceLabel, teamLabel].toSorted(),
    );
  });

  it("rejects a state, assignee, label or team from somewhere else", async () => {
    const other = await createTeam(db, { workspaceId, key: "OPS", name: "Ops" });
    const foreignTeam = await firstTeam(db, outsiderWorkspaceId);

    await expect(createIssue(member, { stateId: other.defaultStateId })).rejects.toMatchObject(
      rejectedWith("invalid"),
    );
    await expect(createIssue(member, { assigneeId: outsider.userID })).rejects.toMatchObject(
      rejectedWith("invalid"),
    );
    await expect(createIssue(member, { teamId: foreignTeam.id })).rejects.toMatchObject(
      rejectedWith("not_found"),
    );
    expect(await db.select().from(issue)).toEqual([]);
  });

  it("does not let a user outside the workspace create an issue in it", async () => {
    await expect(createIssue(outsider)).rejects.toMatchObject(rejectedWith("forbidden"));
  });

  it("rejects an ID that another issue already has", async () => {
    const id = await insertIssue(db, outsiderWorkspaceId, { title: "Taken" });

    await expect(
      mutate(member, "issues.create", { id, workspaceId, teamId, title: "Sneaky" }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
    expect(await findIssue(id)).toMatchObject({ workspaceId: outsiderWorkspaceId, title: "Taken" });
  });

  it("needs the server's number allocator: the client version's 0 never reaches Postgres", async () => {
    const id = uuidv7();

    await expect(
      dbProvider.transaction((tx) =>
        mutators.issues.create.fn({
          args: { id, workspaceId, teamId, title: "Client only" },
          ctx: member,
          tx,
        }),
      ),
    ).rejects.toMatchObject({ cause: { constraint: "issue_number_check" } });
    expect(await findIssue(id)).toBeUndefined();
  });
});

describe("issues.update on the server", () => {
  it("changes the issue's own fields", async () => {
    const id = await createIssue(member);
    const parent = await createIssue(member);

    await mutate(member, "issues.update", {
      id,
      title: "Renamed",
      stateId: stateOf("completed"),
      priority: 4,
      assigneeId: admin.userID,
      parentId: parent,
      sortOrder: "Zz",
    });

    expect(await findIssue(id)).toMatchObject({
      title: "Renamed",
      stateId: stateOf("completed"),
      priority: 4,
      assigneeId: admin.userID,
      parentId: parent,
      sortOrder: "Zz",
    });
  });

  it("stores a due date as a calendar date and reads it back as UTC midnight", async () => {
    const id = await createIssue(member);
    const dueDate = Date.UTC(2026, 10, 20);

    await mutate(member, "issues.update", { id, dueDate });

    expect((await findIssue(id))?.dueDate).toBe("2026-11-20");
    const row = await dbProvider.transaction((tx) => tx.run(zql.issue.where("id", id).one()));
    expect(row?.dueDate).toBe(dueDate);
  });

  it("rejects a state of another team and an assignee outside the workspace", async () => {
    const id = await createIssue(member);
    const other = await createTeam(db, { workspaceId, key: "OPS", name: "Ops" });

    await expect(
      mutate(member, "issues.update", { id, stateId: other.defaultStateId }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
    await expect(
      mutate(member, "issues.update", { id, assigneeId: outsider.userID }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
  });

  it("rejects a parent that would make a cycle or is in another workspace", async () => {
    const grandparent = await createIssue(member);
    const parent = await createIssue(member, { parentId: grandparent });
    const foreign = await insertIssue(db, outsiderWorkspaceId);

    await expect(
      mutate(member, "issues.update", { id: grandparent, parentId: parent }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
    await expect(
      mutate(member, "issues.update", { id: parent, parentId: parent }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
    await expect(
      mutate(member, "issues.update", { id: parent, parentId: foreign }),
    ).rejects.toMatchObject(rejectedWith("not_found"));
  });

  it("does not let a user outside the workspace change its issues", async () => {
    const id = await createIssue(member);

    await expect(mutate(outsider, "issues.update", { id, title: "Mine" })).rejects.toMatchObject(
      rejectedWith("not_found"),
    );
    expect((await findIssue(id))?.title).toBe("An issue");
  });
});

describe("issues.moveToTeam on the server", () => {
  it("gives the issue a new number, keeps its old key, and maps its state and labels", async () => {
    const other = await createTeam(db, { workspaceId, key: "OPS", name: "Ops" });
    const workspaceLabel = await createLabel(null, "Bug");
    const teamLabel = await createLabel(teamId, "Backend");
    await createIssue(member);
    const id = await createIssue(member, {
      stateId: stateOf("started"),
      labelIds: [workspaceLabel, teamLabel],
    });
    const aliasId = uuidv7();

    await mutate(member, "issues.moveToTeam", { id, teamId: other.teamId, aliasId });

    const moved = await findIssue(id);
    const startedThere = other.states.find((state) => state.category === "started");
    expect(moved).toMatchObject({ teamId: other.teamId, number: 1, stateId: startedThere?.id });
    const aliases = await db.select().from(issueKeyAlias).where(eq(issueKeyAlias.issueId, id));
    expect(aliases).toMatchObject([{ id: aliasId, teamId, number: 2, workspaceId }]);
    const labels = await db.select().from(issueLabel).where(eq(issueLabel.issueId, id));
    expect(labels.map((row) => row.labelId)).toEqual([workspaceLabel]);
  });

  it("rejects a team in another workspace", async () => {
    const id = await createIssue(member);
    const foreignTeam = await firstTeam(db, outsiderWorkspaceId);

    await expect(
      mutate(member, "issues.moveToTeam", { id, teamId: foreignTeam.id, aliasId: uuidv7() }),
    ).rejects.toMatchObject(rejectedWith("not_found"));
  });
});

describe("issue labels and description on the server", () => {
  it("adds a label idempotently and removes it", async () => {
    const id = await createIssue(member);
    const labelId = await createLabel(null);

    await mutate(member, "issues.addLabel", { issueId: id, labelId });
    await mutate(admin, "issues.addLabel", { issueId: id, labelId });
    expect(await db.select().from(issueLabel).where(eq(issueLabel.issueId, id))).toHaveLength(1);

    await mutate(member, "issues.removeLabel", { issueId: id, labelId });
    expect(await db.select().from(issueLabel).where(eq(issueLabel.issueId, id))).toEqual([]);
  });

  it("rejects a label of another team or workspace", async () => {
    const id = await createIssue(member);
    const other = await createTeam(db, { workspaceId, key: "OPS", name: "Ops" });
    const otherTeamLabel = await createLabel(other.teamId, "Infra");
    const foreignLabel = uuidv7();
    await db.insert(label).values({
      id: foreignLabel,
      workspaceId: outsiderWorkspaceId,
      teamId: null,
      name: "Foreign",
      color: "#000000",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const labelId of [otherTeamLabel, foreignLabel]) {
      await expect(
        mutate(member, "issues.addLabel", { issueId: id, labelId }),
      ).rejects.toMatchObject(rejectedWith("invalid"));
    }
  });

  it("replaces the description", async () => {
    const id = await createIssue(member, { description: "Old" });

    await mutate(admin, "issues.setDescription", { issueId: id, body: "New **text**" });

    const [row] = await db.select().from(issueDescription).where(eq(issueDescription.issueId, id));
    expect(row?.body).toBe("New **text**");
  });
});

describe("archive and trash on the server", () => {
  it("archives, trashes and restores an issue", async () => {
    const id = await createIssue(member);

    await mutate(member, "issues.archive", { id });
    expect((await findIssue(id))?.archivedAt).toBeInstanceOf(Date);
    await mutate(member, "issues.trash", { id });
    expect((await findIssue(id))?.deletedAt).toBeInstanceOf(Date);
    await mutate(member, "issues.restore", { id });
    await mutate(member, "issues.unarchive", { id });

    expect(await findIssue(id)).toMatchObject({ archivedAt: null, deletedAt: null });
  });

  it("deletes a trashed issue permanently, with its rows, and frees its sub-issues", async () => {
    const parent = await createIssue(member, { description: "Gone" });
    const child = await createIssue(member, { parentId: parent });
    await mutate(member, "comments.create", { id: uuidv7(), issueId: parent, body: "Bye" });
    await mutate(member, "issues.trash", { id: parent });

    await mutate(admin, "issues.deletePermanently", { id: parent });

    expect(await findIssue(parent)).toBeUndefined();
    expect((await findIssue(child))?.parentId).toBeNull();
    expect(await db.select().from(comment).where(eq(comment.issueId, parent))).toEqual([]);
    expect(
      await db.select().from(issueDescription).where(eq(issueDescription.issueId, parent)),
    ).toEqual([]);
  });

  it("deletes permanently only from the Trash", async () => {
    const id = await createIssue(member);

    await expect(mutate(admin, "issues.deletePermanently", { id })).rejects.toMatchObject(
      rejectedWith("invalid"),
    );
    expect(await findIssue(id)).toBeDefined();
  });
});

describe("database errors", () => {
  it("reports a database error with a safe message", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    // A constraint added inside the transaction makes Postgres reject the
    // insert. The rollback removes the constraint again.
    const result = dbProvider.transaction(async (tx) => {
      await tx.dbTransaction.query(
        `alter table issue add constraint issue_test_title_check check (title <> 'Rejected')`,
        [],
      );
      return runMutator(
        tx,
        "issues.create",
        { id: uuidv7(), workspaceId, teamId, title: "Rejected" },
        member,
      );
    });

    const error: unknown = await result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toMatchObject({
      details: { code: "internal" },
      message: expect.not.stringMatching(/insert|constraint|Rejected/i),
    });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
