// About 50 concurrent clients against zero-cache, for decision record 0004.
// Run `pnpm spike:clients` with the stack up and the spike data seeded. Each
// client syncs every issue in the workspace plus a filtered list, then changes
// a random issue's status every 3 to 7 seconds (SPIKE_MIN_INTERVAL_MS and
// SPIKE_MAX_INTERVAL_MS change this). One extra client measures how
// long each change takes to reach it. `docker stats` samples zero-cache.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

import { mutators, queries, schema } from "@curved/zero";
import { Zero } from "@rocicorp/zero";

import { recordResult, summarize } from "./results";

const CACHE_URL = process.env.VITE_ZERO_CACHE_URL ?? "http://localhost:4848";
const WORKSPACE_ID = "00000000-0000-7000-8000-000000000001";
const CLIENTS = Number(process.env.SPIKE_CLIENTS ?? 50);
const WORKERS = 5;
const IDLE_MS = 30_000;
const ACTIVE_MS = 60_000;
// Each client waits a random time in this range between status changes.
const MIN_INTERVAL_MS = Number(process.env.SPIKE_MIN_INTERVAL_MS ?? 3000);
const MAX_INTERVAL_MS = Number(process.env.SPIKE_MAX_INTERVAL_MS ?? 7000);
const statuses = ["todo", "in_progress", "done"] as const;

type Status = (typeof statuses)[number];
type IssueRow = { id: string; status: Status };
type WorkerMessage =
  | { type: "hydrated"; ms: number }
  | { type: "mutated"; key: string; at: number }
  | { type: "result"; ok: boolean; message?: string };

// Instances in one thread share a memory store unless each has its own
// storage key, and would then count as one client group.
function createClient() {
  return new Zero({
    cacheURL: CACHE_URL,
    schema,
    mutators,
    kvStore: "mem",
    storageKey: crypto.randomUUID(),
  });
}

async function runClients(count: number) {
  const port = parentPort;
  if (!port) {
    throw new Error("Not running in a worker");
  }
  const clients = await Promise.all(
    Array.from({ length: count }, async () => {
      const zero = createClient();
      const start = performance.now();
      let rows: readonly IssueRow[] = [];
      const all = zero.materialize(queries.issues.byWorkspace({ workspaceId: WORKSPACE_ID }));
      const filtered = zero.materialize(
        queries.issues.byFilter({ workspaceId: WORKSPACE_ID, statuses: ["todo"] }),
      );
      await Promise.all([
        new Promise<void>((resolve) => {
          all.addListener((data, resultType) => {
            rows = data;
            if (resultType === "complete") {
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => {
          filtered.addListener((_data, resultType) => {
            if (resultType === "complete") {
              resolve();
            }
          });
        }),
      ]);
      port.postMessage({ type: "hydrated", ms: performance.now() - start } satisfies WorkerMessage);
      return { zero, rows: () => rows };
    }),
  );

  port.once("message", (message: { activeMs: number }) => {
    const stopAt = Date.now() + message.activeMs;
    for (const client of clients) {
      const tick = async () => {
        while (Date.now() < stopAt) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS),
            ),
          );
          const rows = client.rows();
          const row = rows[Math.floor(Math.random() * rows.length)];
          if (!row) {
            continue;
          }
          const status = statuses.filter((s) => s !== row.status)[Math.floor(Math.random() * 2)];
          if (!status) {
            continue;
          }
          port.postMessage({
            type: "mutated",
            key: `${row.id}:${status}`,
            at: Date.now(),
          } satisfies WorkerMessage);
          const result = await client.zero.mutate(mutators.issues.setStatus({ id: row.id, status }))
            .server;
          port.postMessage({
            type: "result",
            ok: result.type === "success",
            message: result.type === "error" ? result.error.message : undefined,
          } satisfies WorkerMessage);
        }
      };
      void tick().then(async () => client.zero.close());
    }
  });
}

type Sample = { at: number; cpu: number; memMiB: number };

async function sampleZeroCache(samples: Sample[], until: () => boolean) {
  const run = promisify(execFile);
  while (!until()) {
    const { stdout } = await run("docker", [
      "stats",
      "--no-stream",
      "--format",
      "{{.CPUPerc}},{{.MemUsage}}",
      "curved-zero-cache-1",
    ]);
    const [cpu = "0", mem = "0"] = stdout.trim().split(",");
    const memValue = Number.parseFloat(mem);
    samples.push({
      at: Date.now(),
      cpu: Number.parseFloat(cpu),
      memMiB: mem.includes("GiB") ? memValue * 1024 : memValue,
    });
  }
}

function phaseStats(samples: Sample[], from: number, to: number) {
  const inPhase = samples.filter((sample) => sample.at >= from && sample.at < to);
  const cpu = inPhase.map((sample) => sample.cpu);
  return {
    samples: inPhase.length,
    cpuPercentAvg: Math.round(cpu.reduce((a, b) => a + b, 0) / Math.max(1, cpu.length)),
    cpuPercentMax: Math.round(Math.max(0, ...cpu)),
    memMiBMax: Math.round(Math.max(0, ...inPhase.map((sample) => sample.memMiB))),
  };
}

async function main() {
  const samples: Sample[] = [];
  let done = false;
  const sampling = sampleZeroCache(samples, () => done);
  const phases: Record<string, [number, number]> = {};
  const mark = (name: string, from: number) => {
    phases[name] = [from, Date.now()];
  };

  // The observer measures how long other clients' changes take to arrive.
  const observer = createClient();
  const pending = new Map<string, number>();
  const latencies: number[] = [];
  const known = new Map<string, Status>();
  await new Promise<void>((resolve) => {
    const view = observer.materialize(queries.issues.byWorkspace({ workspaceId: WORKSPACE_ID }));
    view.addListener((data, resultType) => {
      const now = Date.now();
      for (const row of data) {
        if (known.get(row.id) !== row.status) {
          const sentAt = pending.get(`${row.id}:${row.status}`);
          if (sentAt !== undefined) {
            latencies.push(now - sentAt);
            pending.delete(`${row.id}:${row.status}`);
          }
          known.set(row.id, row.status);
        }
      }
      if (resultType === "complete") {
        resolve();
      }
    });
  });

  const baselineStart = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  mark("baseline", baselineStart);

  const connectStart = Date.now();
  const hydration: number[] = [];
  let mutations = 0;
  const failures: string[] = [];
  const workers = Array.from({ length: WORKERS }, (_, index) => {
    const count = Math.floor(CLIENTS / WORKERS) + (index < CLIENTS % WORKERS ? 1 : 0);
    const worker = new Worker(new URL(import.meta.url), { workerData: { count } });
    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "hydrated") {
        hydration.push(message.ms);
      } else if (message.type === "mutated") {
        mutations++;
        pending.set(message.key, message.at);
      } else if (!message.ok) {
        failures.push(message.message ?? "unknown");
      }
    });
    return worker;
  });
  while (hydration.length < CLIENTS) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  mark("connect", connectStart);

  const idleStart = Date.now();
  await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
  mark("idle", idleStart);

  const activeStart = Date.now();
  for (const worker of workers) {
    worker.postMessage({ activeMs: ACTIVE_MS }, []);
  }
  await new Promise((resolve) => setTimeout(resolve, ACTIVE_MS + 8000));
  mark("active", activeStart);

  await Promise.all(workers.map(async (worker) => worker.terminate()));
  await observer.close();
  done = true;
  await sampling;

  const result = {
    clients: CLIENTS,
    intervalMs: [MIN_INTERVAL_MS, MAX_INTERVAL_MS],
    hydrationMs: summarize(hydration),
    allConnectedMs: phases.connect ? phases.connect[1] - phases.connect[0] : null,
    mutations,
    mutationFailures: failures.length,
    observedChanges: latencies.length,
    propagationMs: summarize(latencies),
    zeroCache: Object.fromEntries(
      Object.entries(phases).map(([name, [from, to]]) => [name, phaseStats(samples, from, to)]),
    ),
  };
  recordResult(`concurrent-clients-${MIN_INTERVAL_MS}-${MAX_INTERVAL_MS}`, result);
}

if (isMainThread) {
  await main();
  process.exit(0);
} else {
  const data: { count: number } = workerData;
  await runClients(data.count);
}
