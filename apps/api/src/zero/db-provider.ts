import type { Db } from "@curved/db";
import { schema } from "@curved/zero";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";

export function createDbProvider(db: Db) {
  return zeroDrizzle(schema, db);
}

export type DbProvider = ReturnType<typeof createDbProvider>;

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    dbProvider: DbProvider;
  }
}
