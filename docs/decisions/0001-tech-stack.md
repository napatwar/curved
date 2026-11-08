---
status: accepted, partly superseded by 0003
date: 2026-11-05
---

# Tech stack

## Context and problem statement

Curved is an open-source task management tool with Linear as its reference product. Linear feels fast because its client works on local data and syncs in the background, so the sync layer drives the other decisions.

Cloud is the main long-term target. Self-hosting is aimed at one person up to teams of tens.

## Considered options

For the sync layer, which shapes the rest of the stack:

- Zero
- Electric with TanStack DB
- A REST API with TanStack Query and WebSocket invalidation
- A custom sync engine

## Decision outcome

Chosen option: Zero, with the stack below. Zero covers local reads, optimistic writes and realtime sync, while Postgres stays the source of truth.

| Area            | Choice                                     | Reason                                                                                |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Sync            | Zero                                       | Covers both the read and write paths                                                  |
| Web             | React, TypeScript, Tailwind CSS, shadcn/ui | Well suited to a dense app UI, with a large contributor base                          |
| Web build       | Vite SPA, TanStack Router                  | The app sits behind a login, so it does not need SSR or SEO                           |
| API             | Node.js, Hono                              | Zero serves most reads, and queries and mutators can share TypeScript with the client |
| Public API      | REST, OpenAPI                              | Gives integrators a standard contract                                                 |
| Database        | Postgres 18                                | Required by Zero, and offers partial indexes, JSONB and transactional DDL             |
| ORM             | Drizzle                                    | Stays close to SQL and can generate the Zero schema                                   |
| Background jobs | `pg-boss`, when first needed               | Avoids adding Redis                                                                   |
| Repository      | pnpm workspaces                            | Blocks undeclared dependencies across packages                                        |
| License         | AGPL-3.0-only for the app                  | Keeps hosted modifications open to their users                                        |
| SDK license     | MIT or Apache-2.0                          | Lets integrators adopt SDKs easily                                                    |
| Contributions   | DCO                                        | Keeps contributing simple                                                             |

### Consequences

Keep the Zero replica small. Zero recommends datasets under about 100GB, a size tied to the SQLite replica held by `zero-cache`.

- List synced tables explicitly in the `zero_curved` publication. Do not sync logs or files.
- Put `workspace_id` on every tenant table and use UUIDv7 primary keys, so a workspace can move between databases.
- Do not write app queries that join across workspaces, so the system can later split into cells of Postgres and `zero-cache`.
- Monitor replica size and alert at 50GB.
- Use a Postgres provider with event trigger support, or schema change hooks, to avoid a full reset on each schema change.

Offline means read-only. Zero does not support offline writes. Reads work from synced data. Writes queue during short interruptions, then fail after about one minute by default, so the UI must become read-only.

With DCO, contributed code cannot be relicensed or sold under another license without each contributor's consent. A closed enterprise edition is therefore unlikely to be practical.

Risks:

- Zero is young, comes from a small vendor and changes quickly. Its public repository also no longer includes tests for core packages such as `zero-cache`, so forking would be hard.
- Thai full-text search needs a separate solution because the standard Postgres parsers do not find Thai word boundaries. `kham_pg` is one candidate.
- Drizzle is still before 1.0, so upgrade it deliberately.

## More information

Run a spike before building product features, with 20,000 issues and 60,000 comments.

| Test                           | Target                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| First load with no local data  | Issue list visible within 2 seconds                           |
| Change filter or sort          | No perceptible wait                                           |
| Change issue status            | Immediate locally, visible in another browser within 1 second |
| Multi-condition filters        | No abnormally slow query                                      |
| Server rejects a mutation      | UI rolls back and shows the error                             |
| Offline for more than 1 minute | App becomes read-only and no work is lost                     |
| Schema change                  | No full reset                                                 |
| Rebuild the replica            | Time and real size are measured                               |
| About 50 concurrent clients    | `zero-cache` CPU and memory stay acceptable                   |

Also check support for aggregates, text search, JSON filters and array columns in the Zero version in use.

If the spike fails and query or schema changes cannot fix it, the fallback is Electric with TanStack DB. Postgres, Drizzle and Hono would remain.

Authentication, rich text and the cloud provider are decided separately.
