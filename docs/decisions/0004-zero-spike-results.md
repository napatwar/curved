---
status: proposed
date: 2026-11-08
---

# Zero spike results

## Context and problem statement

[0001](0001-tech-stack.md) chose Zero as the sync layer on condition that a spike with 20,000 issues and 60,000 comments passes its targets before product work starts. If it fails and query or schema changes cannot fix it, the fallback is Electric with TanStack DB. 0001 also estimated about 5KB per row, which needed a real measurement.

This record gives the measured results and recommends whether to keep Zero.

### Setup

- One workspace with 20,000 issues and 60,000 comments, from `pnpm db:seed:spike`. Comments per issue follow a long tail: median 2, maximum 67, and 5,682 issues have none. Comment bodies average 192 characters (232 bytes in UTF-8). About 15% of the text is Thai. Issues have no description column yet.
- `@rocicorp/zero` and `rocicorp/zero` 1.11.3 with default settings, so zero-cache runs 11 sync workers. Postgres 18. Both run in Docker Desktop with 12 CPUs and 7.7GB of memory, on an Apple M6 laptop with 12 cores and 24GB.
- The web app is a production build (`vite build --mode spike`) served by `vite preview` and tested in headless Chromium. The API runs on the host.
- The issue list query (`issues.byWorkspace`) has no limit, so each client syncs and renders all 20,000 issues. This is the worst case for the client.
- Every number is from a local machine with no network latency. Production adds the round trip between the browser and zero-cache.

Scripts: `e2e/spike/*.spec.ts` (`pnpm test:spike`), `e2e/spike/concurrent-clients.ts` (`pnpm spike:clients`) and `e2e/spike/rebuild-replica.ts` (`pnpm spike:rebuild`). They write JSON to `spike-results/`.

## Considered options

- Keep Zero
- Switch to Electric with TanStack DB

## Decision outcome

Chosen option: keep Zero. Every target passed, mostly by a wide margin. No target needed a query or schema change. The problems found are in the app or the tests, or are limits we can design around (see Consequences).

### Results

| Test                           | Target                                                        | Measured                                                                                                                                                                                                                           | Result |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| First load with no local data  | Issue list visible within 2 seconds                           | First row painted at p50 999 ms, max 1,048 ms (5 runs), with all 20,000 rows synced and rendered. Reload with local data: p50 877 ms. HTML ready at 33 ms.                                                                         | Pass   |
| Change filter or sort          | No perceptible wait                                           | Local result in 0.5–14 ms for issue filters and sorts. Server-confirmed in 19–74 ms. Repeating a query: under 3 ms. See below.                                                                                                     | Pass   |
| Change issue status            | Immediate locally, visible in another browser within 1 second | Zero query sees the change locally at p95 8 ms, and in a second browser at p95 126 ms (20 changes). Through the React UI: p95 98 ms locally and 212 ms in the second browser.                                                      | Pass   |
| Multi-condition filters        | No abnormally slow query                                      | Up to 5 conditions, including a comment text `whereExists`: 22–44 ms to the server-confirmed result. zero-cache flagged only the unlimited 20,000-row list as slow (about 220 ms to hydrate).                                      | Pass   |
| Server rejects a mutation      | UI rolls back and shows the error                             | Optimistic change at about 62 ms (React render), rolled back at 138–165 ms and the error shown about 70 ms later (9 runs). One full-suite run took 834 ms. Postgres kept the old value.                                            | Pass   |
| Offline for more than 1 minute | App becomes read-only and no work is lost                     | Offline detected after 9.2 s, read-only after 69.2 s (`disconnected`), and reads kept working. A write made while reconnecting was queued and saved to Postgres after the network returned. Reconnect took 3.1 s.                  | Pass   |
| Schema change                  | No full reset                                                 | Add or drop a column, change a column type, add or drop an index, and add a table to the publication: each reached the replica in 52–137 ms with no reset. The connected client did not reconnect or reload and could still write. | Pass   |
| Rebuild the replica            | Time and real size are measured                               | 80,003 rows copied in 0.22 s. zero-cache healthy after 16.2 s, of which a plain restart takes 15.3 s. Fresh replica: 38MB. At 10 times the data (880,003 rows): copied in 2.0 s, healthy after 16.2 s, 419MB.                      | Pass   |
| About 50 concurrent clients    | `zero-cache` CPU and memory stay acceptable                   | See below. Writes reached other clients at p95 119–122 ms with no failures. Memory and the cost of all clients connecting at once need sizing in production.                                                                       | Pass   |

### Filter and sort

The page had already synced every issue, so issue filters run locally. A filter on comment text needs comments from the server first.

| Query (`issues.byFilter`, limit 100)                       | Local result   | Server-confirmed |
| ---------------------------------------------------------- | -------------- | ---------------- |
| Sort by `createdAt`, `updatedAt`, `title` or `status`      | 1.1–13.6 ms    | 29–57 ms         |
| Status filter                                              | 0.6 ms         | 19 ms            |
| Title contains English or Thai text (`ILIKE`)              | 0.5–1.0 ms     | 22–24 ms         |
| 2 statuses, title text, created range, updated range, sort | 6.3 ms         | 22 ms            |
| Comment text contains                                      | 36 ms (0 rows) | 74 ms            |
| Status, title text and comment text                        | 2.5 ms (1 row) | 44 ms (72 rows)  |
| 1,000 rows sorted by title                                 | 0.6 ms         | 40 ms            |

### 50 concurrent clients

Each Node.js client synced all 20,000 issues and a filtered list. All 50 connected at once, idled for 30 seconds, then each changed a random issue's status during 60 seconds. One more client measured how long each change took to reach it. CPU is in Docker's units, where 100% is one core.

| Phase                       | zero-cache CPU average / peak | Memory peak | Notes                                          |
| --------------------------- | ----------------------------- | ----------- | ---------------------------------------------- |
| No clients                  | 11–19% / 72%                  | 1.2–1.9GB   | Baseline with 11 sync workers                  |
| 50 clients connect at once  | 490–590% / 1,240%             | 4.2–4.7GB   | Every client synced in 9.6 s, p50 5.5 s        |
| 50 clients idle             | 22–30% / 150%                 | 4.3–4.6GB   |                                                |
| 1.5 writes per second       | 110% / 385%                   | 2.5GB       | 92 writes, delivered at p95 122 ms             |
| 10 writes per second (load) | 414% / 715%                   | 2.2GB       | 612 writes, p95 119 ms, p99 213 ms, max 411 ms |

### Size

| Measure                                        | Issues    | Comments  |
| ---------------------------------------------- | --------- | --------- |
| Postgres, table and indexes, per row           | 253 bytes | 454 bytes |
| zero-cache replica, table and indexes, per row | 294 bytes | 535 bytes |

The fresh replica is about 475 bytes per row on average, about a tenth of the 5KB estimate. At this row shape, 50GB holds about 105 million rows and 100GB about 210 million. Issue descriptions in rich text will make rows larger, so measure again once they exist. The replica also keeps a change log, `_zero.changeLog2`, which was 13MB here after heavy churn. zero-cache purges it over time.

A rebuild copied about 200MB per second. If that scales linearly, a 50GB replica would take about 4 to 5 minutes to rebuild and 100GB about 9 minutes, on top of startup. This is an estimate from a laptop with a fast disk, not a measurement.

### Query features in Zero 1.11.3

Checked in the package's types and source.

| Feature      | Supported | Details                                                                                                                                                                                |
| ------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregates   | No        | ZQL has no `count`, `sum` or `group by`. Counts need a stored counter column, or syncing the rows and counting on the client.                                                          |
| Text search  | Partly    | `LIKE`, `ILIKE` and their `NOT` forms, so substring matching only. No full-text index, ranking or word segmentation. Thai substrings match. Full-text search needs a separate service. |
| JSON filters | No        | `json` and `jsonb` columns sync as JSON values, but `where` does not accept them. Filter in JavaScript after reading.                                                                  |
| Arrays       | No        | Postgres arrays sync as JSON, so the same limit applies. Use a junction table, such as `issue_label`, for anything we need to filter on.                                               |

### Consequences

- Good, because Zero meets every target at this scale without query or schema changes, so product work can start.
- Good, because the replica is about ten times smaller per row than estimated, and schema changes, including a new synced table, apply without a reset.
- Bad, because rendering every issue costs the client about 60–100 ms in React on each change, and hydrating the unlimited query costs zero-cache about 220 ms per client. The issue list needs a virtualized list and limited queries before real use. This is an app concern, and Electric would face the same cost.
- Bad, because zero-cache memory grows with connected clients that sync large queries. It used 4.7GB with 50 clients that each synced the whole workspace. Set `ZERO_NUM_SYNC_WORKERS` and a memory limit in production, prefer limited queries, and monitor memory along with replica size.
- Bad, because many clients connecting at once, such as after a deploy, saturated all 12 cores for about 10 seconds.
- Bad, because there are no aggregates, no full-text search and no JSON or array filters. Model filterable lists as tables, keep counters in columns, and plan search separately, which 0001 already expects for Thai.
- Bad, because a database error inside a mutator reaches the client as Drizzle's message, which includes the SQL and its parameters. Mutators must catch database errors and throw messages that are safe to show.
- Neutral, because Zero also settles a queued mutation's server promise with an error of type `zero` when it disconnects, even though the change stays queued and is sent later. The issue list now reports only errors of type `app` as not saved.

## More information

Changes made for the spike:

- A `comment` table (migrations 0002 and 0003) and Drizzle relations, so the Zero schema has `issue.comments`.
- `issues.byFilter`, a query with filters and sorts. No screen uses it yet.
- The issue list shows the error when the server rejects a change.
- A test hook, `use-expose-zero.ts`, puts the Zero instance on `window` in every build mode except production, so the spike can drive Zero directly.

Observations to keep in mind:

- Playwright's role and text locators, such as `getByRole`, scan every element on the page's main thread. With 40,000 elements this blocked Zero for seconds. It delayed incoming messages, which first looked like a 5-second server delay, and paused Zero's disconnect timer. End-to-end tests with large lists should use CSS locators.
- Once, during a series of quick schema changes, a zero-cache sync worker failed with `no such column` while it was rebuilding a large query. It closed the client's connection with an internal error, and the client reconnected. Five targeted attempts and a clean run did not reproduce it. Report it to Rocicorp if it happens again.

Follow-up work:

- Before the issue list is real: a virtualized list, limited queries, and a preload strategy.
- Map database errors in mutators to safe messages.
- Measure again with issue descriptions, and with network latency between the browser and zero-cache.
- Size zero-cache workers and memory for production.
