import { mutators, queries, schema } from "@curved/zero";
import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { Hono } from "hono";

import { dbProvider } from "./db-provider";

// zero-cache calls these endpoints. Authentication is not implemented yet, so
// every request runs without a user and the API must stay on a trusted network.
export const zeroEndpoints = new Hono();

zeroEndpoints.post("/query", async (c) => {
  const result = await handleQueryRequest({
    handler: (name, args) => mustGetQuery(queries, name).fn({ args }),
    schema,
    request: c.req.raw,
    userID: null,
  });
  return c.json(result);
});

zeroEndpoints.post("/mutate", async (c) => {
  const result = await handleMutateRequest({
    dbProvider,
    handler: (transact) =>
      transact((tx, name, args) => mustGetMutator(mutators, name).fn({ args, tx })),
    request: c.req.raw,
    userID: null,
  });
  return c.json(result);
});
