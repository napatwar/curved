import { Zero } from "@rocicorp/zero";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mutators } from ".";
import { schema, zql } from "../schema.gen";

// Runs the shared mutators in a real Zero client with no server, so
// `tx.location` is "client". The server versions are tested against Postgres
// in apps/api/src/zero/*.integration.test.ts.

const userID = uuidv7();
const workspaceId = uuidv7();
const teamId = uuidv7();
const stateIds = Array.from({ length: 5 }, () => uuidv7());

let zero: Zero;

beforeEach(async () => {
  zero = new Zero({
    cacheURL: null,
    schema,
    mutators,
    userID,
    context: { userID },
    kvStore: "mem",
  });
  const created = await zero.mutate(
    mutators.teams.create({ id: teamId, workspaceId, key: "eng", name: "Engineering", stateIds }),
  ).client;
  if (created.type !== "success") {
    throw new Error("Could not create the team");
  }
});

afterEach(async () => {
  await zero.close();
});

async function createIssue(title: string) {
  const id = uuidv7();
  const result = zero.mutate(
    mutators.issues.create({ id, workspaceId, teamId, title, description: "Body" }),
  );
  expect(await result.client).toEqual({ type: "success" });
  return id;
}

describe("mutators on the client", () => {
  it("creates a team with the default states and Todo as the default", async () => {
    const team = await zero.run(
      zql.team
        .where("id", teamId)
        .related("states", (states) => states.orderBy("position", "asc"))
        .one(),
    );

    expect(team).toMatchObject({ key: "ENG", nextIssueNumber: 1, defaultStateId: stateIds[1] });
    expect(team?.states.map((state) => state.category)).toEqual([
      "backlog",
      "unstarted",
      "started",
      "completed",
      "canceled",
    ]);
  });

  it("inserts an issue with a pending number, the default state and its description", async () => {
    const id = await createIssue("Pending");

    const issue = await zero.run(zql.issue.where("id", id).related("description").one());

    expect(issue).toMatchObject({
      number: 0,
      stateId: stateIds[1],
      creatorId: userID,
      priority: 0,
      sortOrder: "a0",
      archivedAt: null,
      deletedAt: null,
      description: { body: "Body", workspaceId },
    });
  });

  it("puts a new issue before the first one it has synced", async () => {
    const first = await createIssue("First");
    const second = await createIssue("Second");

    const issues = await zero.run(
      zql.issue.where("teamId", teamId).orderBy("sortOrder", "asc").orderBy("id", "asc"),
    );

    expect(issues.map((issue) => issue.id)).toEqual([second, first]);
    expect(issues.map((issue) => issue.number)).toEqual([0, 0]);
  });

  it("adds no key alias when an issue with a pending number moves to another team", async () => {
    const id = await createIssue("Moving");
    const otherTeamId = uuidv7();
    await zero.mutate(
      mutators.teams.create({
        id: otherTeamId,
        workspaceId,
        key: "DES",
        name: "Design",
        stateIds: Array.from({ length: 5 }, () => uuidv7()),
      }),
    ).client;

    await zero.mutate(mutators.issues.moveToTeam({ id, teamId: otherTeamId, aliasId: uuidv7() }))
      .client;

    const issue = await zero.run(zql.issue.where("id", id).related("state").one());
    expect(issue).toMatchObject({
      teamId: otherTeamId,
      number: 0,
      state: { category: "unstarted" },
    });
    expect(await zero.run(zql.issueKeyAlias)).toEqual([]);
  });
});
