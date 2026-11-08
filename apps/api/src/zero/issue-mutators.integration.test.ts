import { createDb } from "@curved/db";
import { DEV_WORKSPACE_ID } from "@curved/db/constants";
import { issue } from "@curved/db/schema";
import { mutators, schema } from "@curved/zero";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { testDatabaseUrl } from "../../../../test/database";

const db = createDb(testDatabaseUrl);
const dbProvider = zeroDrizzle(schema, db);

beforeEach(async () => {
  await db.delete(issue);
});

afterAll(async () => {
  await db.$client.end();
});

describe("issue mutators on the server", () => {
  it("creates an issue with the todo status", async () => {
    const id = uuidv7();

    await dbProvider.transaction((tx) =>
      mutators.issues.create.fn({
        args: { id, workspaceId: DEV_WORKSPACE_ID, title: "Write tests" },
        tx,
      }),
    );

    const [row] = await db.select().from(issue).where(eq(issue.id, id));
    expect(row).toMatchObject({ title: "Write tests", status: "todo" });
  });

  it("changes the status of an issue", async () => {
    const id = uuidv7();
    await dbProvider.transaction((tx) =>
      mutators.issues.create.fn({
        args: { id, workspaceId: DEV_WORKSPACE_ID, title: "Ship it" },
        tx,
      }),
    );

    await dbProvider.transaction((tx) =>
      mutators.issues.setStatus.fn({ args: { id, status: "done" }, tx }),
    );

    const [row] = await db.select().from(issue).where(eq(issue.id, id));
    expect(row?.status).toBe("done");
  });
});
