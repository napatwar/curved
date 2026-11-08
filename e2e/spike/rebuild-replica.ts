// Deletes the zero-cache replica and measures how long zero-cache takes to
// rebuild it from Postgres, and how big it is, for decision record 0004.
// Run `pnpm spike:rebuild` with the stack up. Connected clients lose their
// sync state and download their data again.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "pg";

import { recordResult } from "./results";

const CONTAINER = "curved-zero-cache-1";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:pass@localhost:5432/curved";

function run(command: string, args: string[]) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const db = new Client({ connectionString: DATABASE_URL });
await db.connect();
const { rows: postgres } = await db.query<{ table: string; rows: string; bytes: string }>(`
  select relname as table, n_live_tup as rows, pg_total_relation_size(relid) as bytes
  from pg_stat_user_tables where relname in ('issue', 'comment')`);
await db.end();

run("docker", ["compose", "stop", "zero-cache"]);
run("docker", [
  "compose",
  "run",
  "--rm",
  "--no-deps",
  "--entrypoint",
  "sh",
  "zero-cache",
  "-c",
  "rm -f /data/replica.db*",
]);

const startedAt = new Date();
run("docker", ["compose", "up", "-d", "--wait", "zero-cache"]);
const healthyMs = Date.now() - startedAt.getTime();

const logs = run("docker", ["logs", "--since", startedAt.toISOString(), CONTAINER]);
const syncLines = logs
  .split("\n")
  .filter((line) => /initial.sync|Finished copying|Copied|copying/i.test(line))
  .map((line) => /"message":"([^"]{0,160})/.exec(line)?.[1] ?? line.slice(0, 160));

const files = run("docker", ["exec", CONTAINER, "sh", "-c", "ls -l /data | tail -n +2"])
  .trim()
  .split("\n")
  .map((line) => {
    const parts = line.trim().split(/\s+/);
    return { file: parts.at(-1), bytes: Number(parts[4]) };
  });

// Zero's replica uses SQLite's wal2 mode, which only its own SQLite build reads.
const dir = mkdtempSync(join(tmpdir(), "curved-replica-"));
run("docker", ["cp", `${CONTAINER}:/data/replica.db`, dir]);
const zeroRequire = createRequire(import.meta.resolve("@rocicorp/zero"));
type SqliteDatabase = new (
  path: string,
  options: { readonly: boolean },
) => { prepare(sql: string): { all(): unknown[] }; close(): void };
const Database: SqliteDatabase = zeroRequire("@rocicorp/zero-sqlite3");
const replica = new Database(join(dir, "replica.db"), { readonly: true });
const objects = replica
  .prepare("select name, sum(pgsize) as bytes from dbstat group by name order by bytes desc")
  .all()
  .slice(0, 12);
replica.close();
rmSync(dir, { recursive: true });

recordResult("rebuild-replica", {
  postgres,
  healthyMs,
  syncLog: syncLines,
  files,
  replicaObjects: objects,
});
