import { createDb } from "@curved/db";
import { afterAll, describe, expect, it } from "vitest";

import { testDatabaseUrl } from "../../../../test/database";
import { createDbProvider } from "./db-provider";
import { createZeroEndpoints } from "./endpoints";

const db = createDb(testDatabaseUrl);

afterAll(async () => {
  await db.$client.end();
});

describe("Zero endpoints", () => {
  const endpoints = createZeroEndpoints({
    dbProvider: createDbProvider(db),
    getUserID: async () => null,
  });

  it.each(["/query", "/mutate"])("returns 401 from %s without a session", async (path) => {
    const response = await endpoints.request(`${path}?schema=zero_0&appID=zero`, {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Sign in to continue." },
    });
  });
});
