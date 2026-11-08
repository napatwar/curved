import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import { issue, team } from "@curved/db/schema";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { testDatabaseUrl } from "../../../../test/database";
import {
  addMember,
  createUser,
  createWorkspace,
  firstTeam,
  resetDatabase,
} from "../../../../test/fixtures";
import { createDbProvider } from "./db-provider";
import { createZeroEndpoints } from "./endpoints";
import { serverMutators } from "./server-mutators";

// Issue numbers under concurrency (decision record 0006). Two clients push
// `issues.create` for the same team at the same time, through the /mutate
// endpoint as zero-cache calls it. The server version of the mutator runs
// (`tx.location === "server"`), allocates from `team.next_issue_number`, and
// the row lock keeps every number unique.

const db = createDb(testDatabaseUrl);
const dbProvider = createDbProvider(db);
const UPSTREAM_SCHEMA = "zero_test";
const ISSUES_PER_CLIENT = 15;

let userID: string;
let workspaceId: string;
let teamId: string;

const endpoints = createZeroEndpoints({ dbProvider, getUserID: async () => userID });

beforeAll(async () => {
  // zero-cache creates these tables in Postgres for each app. The push
  // handler records each client's last mutation ID in them. Copied from
  // Zero 1.11.3's zero-cache/src/services/change-source/pg/schema/shard.js.
  await db.$client.query(`
    create schema if not exists "${UPSTREAM_SCHEMA}";
    create table if not exists "${UPSTREAM_SCHEMA}"."clients" (
      "clientGroupID" text not null,
      "clientID" text not null,
      "lastMutationID" bigint not null,
      "userID" text,
      primary key ("clientGroupID", "clientID")
    );
    create table if not exists "${UPSTREAM_SCHEMA}"."mutations" (
      "clientGroupID" text not null,
      "clientID" text not null,
      "mutationID" bigint not null,
      "result" json not null,
      primary key ("clientGroupID", "clientID", "mutationID")
    );
  `);
});

beforeEach(async () => {
  await resetDatabase(db);
  await db.$client.query(
    `truncate "${UPSTREAM_SCHEMA}"."clients", "${UPSTREAM_SCHEMA}"."mutations"`,
  );
  userID = await createUser(db);
  workspaceId = await createWorkspace(db);
  await addMember(db, workspaceId, userID);
  ({ id: teamId } = await firstTeam(db, workspaceId));
});

afterAll(async () => {
  await db.$client.query(`drop schema if exists "${UPSTREAM_SCHEMA}" cascade`);
  await db.$client.end();
});

/** Sends one push with one `issues.create` mutation, as a Zero client does. */
async function pushCreate(clientID: string, mutationID: number) {
  const response = await endpoints.request(`/mutate?schema=${UPSTREAM_SCHEMA}&appID=zero`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientGroupID: `group-${clientID}`,
      mutations: [
        {
          type: "custom",
          id: mutationID,
          clientID,
          name: "issues.create",
          args: [{ id: uuidv7(), workspaceId, teamId, title: `${clientID} #${mutationID}` }],
          timestamp: Date.now(),
        },
      ],
      pushVersion: 1,
      timestamp: Date.now(),
      requestID: uuidv7(),
    }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

/** One client sends its mutations in order, each after the last one returns. */
async function runClient(clientID: string) {
  const results = [];
  for (let mutationID = 1; mutationID <= ISSUES_PER_CLIENT; mutationID++) {
    results.push(await pushCreate(clientID, mutationID));
  }
  return results;
}

describe("issue numbers under concurrency", () => {
  it("gives every issue a unique number when two clients create issues in one team at once", async () => {
    const [first, second] = await Promise.all([runClient("client-a"), runClient("client-b")]);

    for (const result of [...first, ...second]) {
      expect(result).toMatchObject({ mutations: [{ result: {} }] });
    }
    const rows = await db.select().from(issue).where(eq(issue.teamId, teamId));
    const numbers = rows.map((row) => row.number).toSorted((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: ISSUES_PER_CLIENT * 2 }, (_, n) => n + 1));
    // Each client's issues keep the order it sent them in.
    for (const clientID of ["client-a", "client-b"]) {
      const own = rows
        .filter((row) => row.title.startsWith(clientID))
        .toSorted((a, b) => a.number - b.number)
        .map((row) => Number(row.title.split("#")[1]));
      expect(own).toEqual(Array.from({ length: ISSUES_PER_CLIENT }, (_, n) => n + 1));
    }
    const [teamRow] = await db.select().from(team).where(eq(team.id, teamId));
    expect(teamRow?.nextIssueNumber).toBe(ISSUES_PER_CLIENT * 2 + 1);
    const clients = await db.$client.query<{ clientID: string; lastMutationID: string }>(
      `select "clientID", "lastMutationID" from "${UPSTREAM_SCHEMA}"."clients" order by 1`,
    );
    expect(clients.rows).toEqual([
      { clientID: "client-a", lastMutationID: String(ISSUES_PER_CLIENT) },
      { clientID: "client-b", lastMutationID: String(ISSUES_PER_CLIENT) },
    ]);
  });

  it("makes a second transaction in the same team wait for the first to commit", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ctx = { userID };
    const create = (title: string) => ({ id: uuidv7(), workspaceId, teamId, title });
    const events: string[] = [];

    const first = dbProvider.transaction(async (tx) => {
      await serverMutators.issues.create.fn({ args: create("First"), ctx, tx });
      events.push("first created");
      await gate;
      events.push("first commits");
    });
    // Let the first transaction take the team's row lock.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = dbProvider
      .transaction((tx) => serverMutators.issues.create.fn({ args: create("Second"), ctx, tx }))
      .then(() => events.push("second created"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(events).toEqual(["first created"]);

    release?.();
    await Promise.all([first, second]);

    expect(events).toEqual(["first created", "first commits", "second created"]);
    const rows = await db.select().from(issue).where(eq(issue.teamId, teamId));
    expect(Object.fromEntries(rows.map((row) => [row.title, row.number]))).toEqual({
      First: 1,
      Second: 2,
    });
  });

  it("puts every new issue at the top with a distinct sort key", async () => {
    await Promise.all([runClient("client-a"), runClient("client-b")]);

    const rows = await db.select().from(issue).where(eq(issue.teamId, teamId));
    const byNumber = rows.toSorted((a, b) => b.number - a.number).map((row) => row.sortOrder);
    // The newest issue has the lowest key, under byte order like COLLATE "C".
    expect(byNumber).toEqual(byNumber.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(new Set(byNumber).size).toBe(rows.length);
  });
});
