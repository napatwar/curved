import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import { issue } from "@curved/db/schema";
import { mutators, type ZeroContext } from "@curved/zero";
import { ApplicationError } from "@rocicorp/zero";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { testDatabaseUrl } from "../../../../test/database";
import { addMember, createUser, createWorkspace, resetDatabase } from "../../../../test/fixtures";
import { createDbProvider } from "./db-provider";
import { runMutator } from "./endpoints";

const db = createDb(testDatabaseUrl);
const dbProvider = createDbProvider(db);

let member: ZeroContext;
let viewer: ZeroContext;
let outsider: ZeroContext;
let workspaceId: string;
let outsiderWorkspaceId: string;

beforeEach(async () => {
  await resetDatabase(db);
  member = { userID: await createUser(db, "Member") };
  viewer = { userID: await createUser(db, "Viewer") };
  outsider = { userID: await createUser(db, "Outsider") };
  workspaceId = await createWorkspace(db);
  await addMember(db, workspaceId, member.userID);
  await addMember(db, workspaceId, viewer.userID);
  outsiderWorkspaceId = await createWorkspace(db);
  await addMember(db, outsiderWorkspaceId, outsider.userID);
});

afterAll(async () => {
  await db.$client.end();
});

function createIssue(ctx: ZeroContext, args: { id: string; workspaceId: string; title: string }) {
  return dbProvider.transaction((tx) => mutators.issues.create.fn({ args, ctx, tx }));
}

function setStatus(ctx: ZeroContext, id: string, status: "todo" | "in_progress" | "done") {
  return dbProvider.transaction((tx) =>
    mutators.issues.setStatus.fn({ args: { id, status }, ctx, tx }),
  );
}

async function findIssue(id: string) {
  const [row] = await db.select().from(issue).where(eq(issue.id, id));
  return row;
}

describe("issue mutators on the server", () => {
  it("creates an issue with the todo status", async () => {
    const id = uuidv7();

    await createIssue(member, { id, workspaceId, title: "Write tests" });

    expect(await findIssue(id)).toMatchObject({ title: "Write tests", status: "todo" });
  });

  it("changes the status of an issue", async () => {
    const id = uuidv7();
    await createIssue(member, { id, workspaceId, title: "Ship it" });

    await setStatus(viewer, id, "done");

    expect((await findIssue(id))?.status).toBe("done");
  });

  it("does not let a user outside the workspace create an issue in it", async () => {
    const id = uuidv7();

    await expect(createIssue(outsider, { id, workspaceId, title: "Sneaky" })).rejects.toMatchObject(
      { details: { code: "forbidden" } },
    );
    expect(await findIssue(id)).toBeUndefined();
  });

  it("does not let a user outside the workspace change its issues", async () => {
    const id = uuidv7();
    await createIssue(member, { id, workspaceId, title: "Keep me" });

    await expect(setStatus(outsider, id, "done")).rejects.toMatchObject({
      details: { code: "not_found" },
    });
    expect((await findIssue(id))?.status).toBe("todo");
  });

  it("does not move another workspace's issue by reusing its ID", async () => {
    const id = uuidv7();
    await createIssue(member, { id, workspaceId, title: "Stay here" });

    // Zero's server insert ignores a primary key conflict.
    await createIssue(outsider, { id, workspaceId: outsiderWorkspaceId, title: "Taken" });

    expect(await findIssue(id)).toMatchObject({ workspaceId, title: "Stay here" });
  });

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
        { id: uuidv7(), workspaceId, title: "Rejected" },
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
