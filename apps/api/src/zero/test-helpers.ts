import type { ZeroContext } from "@curved/zero";
import type { ReadonlyJSONValue } from "@rocicorp/zero";

import type { DbProvider } from "./db-provider";
import { runMutator } from "./endpoints";

/**
 * Runs a mutator by name the way the /mutate endpoint does: on the server, in
 * its own transaction, with errors made safe. Tests only.
 */
export function serverMutate(dbProvider: DbProvider) {
  return (ctx: ZeroContext, name: string, args: ReadonlyJSONValue) =>
    dbProvider.transaction((tx) => runMutator(tx, name, args, ctx));
}

/** Matches a rejected mutation by its error code. */
export function rejectedWith(code: string) {
  return { details: { code } };
}
