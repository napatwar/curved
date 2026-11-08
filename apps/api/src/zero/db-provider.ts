import { createDb } from "@curved/db";
import { schema } from "@curved/zero";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";

import { env } from "../env";

export const db = createDb(env.DATABASE_URL);
export const dbProvider = zeroDrizzle(schema, db);

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}
