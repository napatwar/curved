import { fileURLToPath } from "node:url";

import { createDb } from "@curved/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { logger } from "./logger";

/**
 * Applies pending migrations and exits. The production `migrate` service runs
 * it before the API and zero-cache start, with the migration files copied
 * into the image (MIGRATIONS_DIR), so production does not need drizzle-kit.
 */
const databaseUrl = process.env.DATABASE_URL;
const migrationsFolder =
  process.env.MIGRATIONS_DIR ??
  fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url));

if (!databaseUrl) {
  logger.error("DATABASE_URL is not set");
  process.exit(1);
}

const db = createDb(databaseUrl);
const start = performance.now();

try {
  logger.info("applying migrations", { migrationsFolder });
  await migrate(db, { migrationsFolder });
  logger.info("migrations applied", { durationMs: Math.round(performance.now() - start) });
} catch (error) {
  logger.error("migration failed", { err: error });
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
