import { fileURLToPath } from "node:url";

import { createDb } from "@curved/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import { testDatabaseUrl } from "./database";

const migrationsFolder = fileURLToPath(new URL("../packages/db/migrations", import.meta.url));

/** Creates the test database if needed and applies every migration. */
export async function setup() {
  const url = new URL(testDatabaseUrl);
  const databaseName = url.pathname.slice(1);
  url.pathname = "/postgres";

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const existing = await admin.query("select 1 from pg_database where datname = $1", [
    databaseName,
  ]);
  if (existing.rowCount === 0) {
    await admin.query(`create database "${databaseName}"`);
  }
  await admin.end();

  const db = createDb(testDatabaseUrl);
  await migrate(db, { migrationsFolder });
  await db.$client.end();
}
