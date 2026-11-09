import { queries, schema, toSafeMutationError, type ZeroContext } from "@curved/zero";
import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { Hono } from "hono";

import type { DbProvider } from "./db-provider";
import { serverMutators } from "./server-mutators";

type ServerTransaction = Parameters<Parameters<DbProvider["transaction"]>[0]>[0];

export type ZeroEndpointOptions = {
  dbProvider: DbProvider;
  /** Returns the signed-in user's ID from the request headers, or null. */
  getUserID: (headers: Headers) => Promise<string | null>;
};

/**
 * zero-cache calls these endpoints and forwards the browser's cookies
 * (`ZERO_QUERY_FORWARD_COOKIES` and `ZERO_MUTATE_FORWARD_COOKIES`). Without a
 * valid session they return 401, and the client moves to `needs-auth`.
 */
export function createZeroEndpoints({ dbProvider, getUserID }: ZeroEndpointOptions) {
  const endpoints = new Hono<{ Variables: { ctx: ZeroContext } }>();

  endpoints.use(async (c, next) => {
    const userID = await getUserID(c.req.raw.headers);
    if (!userID) {
      return c.json({ error: { code: "unauthorized", message: "Sign in to continue." } }, 401);
    }
    c.set("ctx", { userID });
    await next();
    return undefined;
  });

  endpoints.post("/query", async (c) => {
    const ctx = c.get("ctx");
    const result = await handleQueryRequest({
      handler: (name, args) => mustGetQuery(queries, name).fn({ args, ctx }),
      schema,
      request: c.req.raw,
      userID: ctx.userID,
    });
    return c.json(result);
  });

  endpoints.post("/mutate", async (c) => {
    const ctx = c.get("ctx");
    const result = await handleMutateRequest({
      dbProvider,
      handler: (transact) => transact((tx, name, args) => runMutator(tx, name, args, ctx)),
      request: c.req.raw,
      userID: ctx.userID,
    });
    return c.json(result);
  });

  return endpoints;
}

/**
 * Runs one mutator. Any error that is not a deliberate `mutationError`, such
 * as a database error with its SQL, reaches the client as a generic message
 * and is logged here instead.
 */
export async function runMutator(
  tx: ServerTransaction,
  name: string,
  args: ReadonlyJSONValue | undefined,
  ctx: ZeroContext,
) {
  try {
    return await mustGetMutator(serverMutators, name).fn({ args, ctx, tx });
  } catch (error) {
    const safeError = toSafeMutationError(error);
    if (safeError.details.code === "internal") {
      console.error(`Mutator ${name} failed`, error);
    }
    throw safeError;
  }
}
