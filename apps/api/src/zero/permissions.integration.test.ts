import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import { comment, issue, label, team, workflowState } from "@curved/db/schema";
import { createTeam } from "@curved/db/teams";
import type { ZeroContext } from "@curved/zero";
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
import { rejectedWith, serverMutate } from "./test-helpers";

// Permissions by role from decision record 0006. Members create, edit, move,
// archive, trash and restore issues, write comments and manage labels. Only
// admins and owners manage teams and workflow states and empty the Trash.

const db = createDb(testDatabaseUrl);
const mutate = serverMutate(createDbProvider(db));

type Role = "owner" | "admin" | "member";

let workspaceId: string;
let teamId: string;
let users: Record<Role, ZeroContext>;

beforeEach(async () => {
  await resetDatabase(db);
  workspaceId = await createWorkspace(db);
  ({ id: teamId } = await firstTeam(db, workspaceId));
  users = {
    owner: await joinAs("owner"),
    admin: await joinAs("admin"),
    member: await joinAs("member"),
  };
});

async function joinAs(role: Role): Promise<ZeroContext> {
  const userID = await createUser(db, role);
  await addMember(db, workspaceId, userID, role);
  return { userID };
}

afterAll(async () => {
  await db.$client.end();
});

function newTeamArgs(key: string) {
  return {
    id: uuidv7(),
    workspaceId,
    key,
    name: `Team ${key}`,
    stateIds: Array.from({ length: 5 }, () => uuidv7()),
  };
}

async function stateIdsOf(id: string) {
  const states = await db
    .select()
    .from(workflowState)
    .where(eq(workflowState.teamId, id))
    .orderBy(workflowState.position);
  return states;
}

/** Each admin-only action, set up fresh and run as the given role. */
const adminActions: Record<string, (ctx: ZeroContext) => Promise<unknown>> = {
  "teams.create": (ctx) => mutate(ctx, "teams.create", newTeamArgs("NEW")),
  "teams.rename": (ctx) => mutate(ctx, "teams.rename", { id: teamId, name: "Renamed" }),
  "teams.setDefaultState": async (ctx) => {
    const [backlog] = await stateIdsOf(teamId);
    return mutate(ctx, "teams.setDefaultState", { id: teamId, stateId: backlog?.id ?? "" });
  },
  "teams.delete": async (ctx) => {
    const extra = await createTeam(db, { workspaceId, key: "TMP", name: "Temporary" });
    return mutate(ctx, "teams.delete", { id: extra.teamId });
  },
  "workflowStates.create": (ctx) =>
    mutate(ctx, "workflowStates.create", {
      id: uuidv7(),
      teamId,
      name: "In Review",
      color: "#00aa00",
      category: "started",
    }),
  "workflowStates.update": async (ctx) => {
    const [backlog] = await stateIdsOf(teamId);
    return mutate(ctx, "workflowStates.update", { id: backlog?.id ?? "", name: "Icebox" });
  },
  "workflowStates.reorder": async (ctx) => {
    const ids = (await stateIdsOf(teamId)).map((state) => state.id);
    return mutate(ctx, "workflowStates.reorder", { teamId, stateIds: ids.toReversed() });
  },
  "workflowStates.delete": async (ctx) => {
    const extra = uuidv7();
    await db.insert(workflowState).values({
      id: extra,
      workspaceId,
      teamId,
      name: "In Review",
      color: "#00aa00",
      category: "started",
      position: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const [backlog] = await stateIdsOf(teamId);
    return mutate(ctx, "workflowStates.delete", { id: extra, targetStateId: backlog?.id ?? "" });
  },
  "issues.deletePermanently": async (ctx) => {
    const id = await insertIssue(db, workspaceId, { deletedAt: new Date() });
    return mutate(ctx, "issues.deletePermanently", { id });
  },
};

describe("admin-only actions", () => {
  it.each(Object.keys(adminActions))("a member cannot run %s", async (name) => {
    await expect(adminActions[name]?.(users.member)).rejects.toMatchObject(
      rejectedWith("forbidden"),
    );
  });

  it.each(
    Object.keys(adminActions).flatMap((name) => [
      [name, "admin" as const],
      [name, "owner" as const],
    ]),
  )("%s works for an %s", async (name, role) => {
    await expect(adminActions[name]?.(users[role])).resolves.toBeUndefined();
  });
});

describe("member actions", () => {
  it("a member manages labels", async () => {
    const id = uuidv7();
    const { member } = users;

    await mutate(member, "labels.create", {
      id,
      workspaceId,
      teamId: null,
      name: "Bug",
      color: "#ff0000",
    });
    await mutate(member, "labels.update", { id, name: "Defect" });
    expect((await db.select().from(label).where(eq(label.id, id)))[0]?.name).toBe("Defect");
    await mutate(member, "labels.delete", { id });

    expect(await db.select().from(label).where(eq(label.id, id))).toEqual([]);
  });

  it("a member creates, edits, archives, trashes and restores issues", async () => {
    const id = uuidv7();
    const { member } = users;

    await mutate(member, "issues.create", { id, workspaceId, teamId, title: "Mine" });
    await mutate(member, "issues.update", { id, title: "Still mine", priority: 2 });
    await mutate(member, "issues.archive", { id });
    await mutate(member, "issues.trash", { id });
    await mutate(member, "issues.restore", { id });

    expect((await db.select().from(issue).where(eq(issue.id, id)))[0]).toMatchObject({
      title: "Still mine",
      deletedAt: null,
    });
  });
});

describe("labels", () => {
  it("keeps names unique per scope, ignoring case", async () => {
    const { member } = users;
    const create = (name: string, scope: string | null) =>
      mutate(member, "labels.create", {
        id: uuidv7(),
        workspaceId,
        teamId: scope,
        name,
        color: "#ff0000",
      });
    await create("Bug", null);

    await expect(create("bug", null)).rejects.toMatchObject(rejectedWith("invalid"));
    await expect(create("BUG", teamId)).resolves.toBeUndefined();
    await expect(create("Bug", teamId)).rejects.toMatchObject(rejectedWith("invalid"));
  });

  it("removes a deleted label from its issues", async () => {
    const { member } = users;
    const labelId = uuidv7();
    await mutate(member, "labels.create", {
      id: labelId,
      workspaceId,
      teamId: null,
      name: "Bug",
      color: "#ff0000",
    });
    const id = uuidv7();
    await mutate(member, "issues.create", {
      id,
      workspaceId,
      teamId,
      title: "Tagged",
      labelIds: [labelId],
    });

    await mutate(member, "labels.delete", { id: labelId });

    expect(await db.query.issueLabel.findMany()).toEqual([]);
  });
});

async function writeComment(ctx: ZeroContext) {
  const issueId = await insertIssue(db, workspaceId);
  const id = uuidv7();
  await mutate(ctx, "comments.create", { id, issueId, body: "First" });
  return id;
}

describe("comments", () => {
  it("sets the author from the session and marks an edit", async () => {
    const id = await writeComment(users.member);

    await mutate(users.member, "comments.edit", { id, body: "Edited" });

    const [row] = await db.select().from(comment).where(eq(comment.id, id));
    expect(row).toMatchObject({ authorId: users.member.userID, body: "Edited" });
    expect(row?.editedAt).toBeInstanceOf(Date);
  });

  it.each(["member", "admin", "owner"] as const)(
    "does not let another %s edit or delete a comment",
    async (role) => {
      const id = await writeComment(role === "member" ? users.owner : users.member);

      await expect(mutate(users[role], "comments.edit", { id, body: "No" })).rejects.toMatchObject(
        rejectedWith("forbidden"),
      );
      await expect(mutate(users[role], "comments.delete", { id })).rejects.toMatchObject(
        rejectedWith("forbidden"),
      );
    },
  );

  it("lets the author delete their comment", async () => {
    const id = await writeComment(users.member);

    await mutate(users.member, "comments.delete", { id });

    expect(await db.select().from(comment).where(eq(comment.id, id))).toEqual([]);
  });

  it("rejects an empty comment", async () => {
    const issueId = await insertIssue(db, workspaceId);

    await expect(
      mutate(users.member, "comments.create", { id: uuidv7(), issueId, body: "  \n" }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
  });
});

describe("teams and workflow states", () => {
  it("creates a team with the default states and rejects a key in use", async () => {
    const args = newTeamArgs("des");

    await mutate(users.admin, "teams.create", args);

    const [row] = await db.select().from(team).where(eq(team.id, args.id));
    expect(row).toMatchObject({ key: "DES", nextIssueNumber: 1, defaultStateId: args.stateIds[1] });
    expect((await stateIdsOf(args.id)).map((state) => state.id)).toEqual(args.stateIds);
    await expect(mutate(users.admin, "teams.create", newTeamArgs("DES"))).rejects.toMatchObject(
      rejectedWith("invalid"),
    );
  });

  it("deletes only a team with no issues, and never the last team", async () => {
    const extra = await createTeam(db, { workspaceId, key: "TMP", name: "Temporary" });
    await insertIssue(db, workspaceId, {
      teamId: extra.teamId,
      stateId: extra.defaultStateId,
      deletedAt: new Date(),
    });

    await expect(mutate(users.admin, "teams.delete", { id: extra.teamId })).rejects.toMatchObject(
      rejectedWith("invalid"),
    );
    await db.delete(issue).where(eq(issue.teamId, extra.teamId));
    await mutate(users.admin, "teams.delete", { id: extra.teamId });
    expect(await stateIdsOf(extra.teamId)).toEqual([]);

    await expect(mutate(users.admin, "teams.delete", { id: teamId })).rejects.toMatchObject(
      rejectedWith("invalid"),
    );
  });

  it("moves a deleted state's issues and the team default to the target", async () => {
    const [backlog, todo, started] = await stateIdsOf(teamId);
    const review = uuidv7();
    await mutate(users.admin, "workflowStates.create", {
      id: review,
      teamId,
      name: "In Review",
      color: "#00aa00",
      category: "started",
    });
    await mutate(users.admin, "teams.setDefaultState", { id: teamId, stateId: review });
    const issueId = await insertIssue(db, workspaceId, { stateId: review });

    await mutate(users.admin, "workflowStates.delete", {
      id: review,
      targetStateId: started?.id ?? "",
    });

    expect((await db.select().from(issue).where(eq(issue.id, issueId)))[0]?.stateId).toBe(
      started?.id,
    );
    expect((await db.select().from(team).where(eq(team.id, teamId)))[0]?.defaultStateId).toBe(
      started?.id,
    );
    // Backlog is its category's only state.
    await expect(
      mutate(users.admin, "workflowStates.delete", {
        id: backlog?.id ?? "",
        targetStateId: todo?.id ?? "",
      }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
  });

  it("renumbers states in the given order and rejects a partial list", async () => {
    const ids = (await stateIdsOf(teamId)).map((state) => state.id);

    await mutate(users.admin, "workflowStates.reorder", { teamId, stateIds: ids.toReversed() });

    expect((await stateIdsOf(teamId)).map((state) => state.id)).toEqual(ids.toReversed());
    await expect(
      mutate(users.admin, "workflowStates.reorder", { teamId, stateIds: ids.slice(1) }),
    ).rejects.toMatchObject(rejectedWith("invalid"));
  });
});
