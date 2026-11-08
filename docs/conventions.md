# Conventions

These rules keep Curved consistent. Tools enforce many of them. [Decision record 0002](decisions/0002-development-conventions.md) explains why we chose them.

## Language

Write code, comments, commit messages and documentation in English.

## Project structure

```text
apps/web/src/
  routes/              TanStack Router route files; keep them thin
  features/<domain>/   Components, hooks and helpers for one domain
  components/          Components shared by several features
  components/ui/       shadcn/ui components
  hooks/               Hooks shared by several features
  lib/                 App-wide setup and helpers
apps/api/src/
  routes/              Public REST routes, grouped by resource
  zero/                Zero query and mutate endpoints
  env.ts               Environment variables, validated with Zod at startup
packages/db/src/schema/        Drizzle schema, one file per domain
packages/zero/src/queries/     Zero queries, one file per domain
packages/zero/src/mutators/    Zero mutators, one file per domain
test/                  Shared test setup
e2e/                   Playwright end-to-end tests
e2e/prod/              End-to-end tests against the production Compose stack
deploy/                Production Compose file, Caddyfile and .env.example
Dockerfile             The curved image
```

- Name feature folders after the domain, such as `issues` or `projects`, not after an action such as `create-issue`. When a domain grows, split it by screen area, such as `issues/board/`, not by action.
- Each feature exposes what other features may use through its `index.ts`.
- Register every domain's queries in `packages/zero/src/queries/index.ts` and every domain's mutators in `packages/zero/src/mutators/index.ts`. Zero requires one top-level `defineQueries` call.
- Put server-only mutator logic, such as allocating issue numbers or sending notifications, in `apps/api`, so it never reaches the browser bundle. Override the shared mutator in `apps/api/src/zero/server-mutators.ts`.
- Every query limits rows with `whereMember`, and every issue list also uses `whereActive`, `whereArchived` or `whereTrashed`. All four live in `packages/zero/src/auth`.

## Imports

| From         | May import                                      | Must not import                   |
| ------------ | ----------------------------------------------- | --------------------------------- |
| `apps/web`   | `@curved/zero`, `@curved/db/constants`          | `@curved/db`, `@curved/db/schema` |
| `apps/api`   | Any package                                     | —                                 |
| `packages/*` | Packages they declare                           | `apps/*`                          |
| `features/a` | `components/`, `hooks/`, `lib/`, `@/features/b` | `@/features/b/<file>`             |

Use the `@/` alias only inside `apps/web`. Import other packages through `@curved/*`, and use relative imports inside a package. Oxlint enforces these rules.

## Naming

| Item                  | Style                                                          | Example                        |
| --------------------- | -------------------------------------------------------------- | ------------------------------ |
| Files                 | kebab-case                                                     | `issue-row.tsx`                |
| Components            | PascalCase                                                     | `IssueRow`                     |
| Hooks                 | `use-*.ts` file, `useX` function                               | `use-can-write.ts`             |
| Exports               | Named exports only, except config files that require a default | `export function IssueRow`     |
| Database tables       | Singular snake_case                                            | `issue`, `issue_label`         |
| Database columns      | snake_case in SQL, camelCase in TypeScript                     | `workspace_id` → `workspaceId` |
| Foreign keys          | `<table>_id`                                                   | `project_id`                   |
| Indexes               | `<table>_<columns>_idx`                                        | `issue_workspace_created_idx`  |
| Zero queries          | `<plural domain>.<byX>`                                        | `issues.byWorkspace`           |
| Zero mutators         | `<plural domain>.<verb>`                                       | `issues.setStatus`             |
| Public REST paths     | `/v1/<plural resource>`, camelCase JSON                        | `/v1/issues`                   |
| Environment variables | SCREAMING_SNAKE_CASE, `VITE_` prefix for browser values        | `VITE_ZERO_CACHE_URL`          |

Route files follow TanStack Router's naming, such as `$issueId.tsx`.

## Data

- Every tenant table has `workspace_id`.
- Primary keys are `id` with UUIDv7. The client generates the `id` when it inserts through Zero.
- Two kinds of table are the exception. A junction table uses its two foreign keys as the primary key, such as `issue_label (issue_id, label_id)`, so two clients that add the same pair make an idempotent upsert. A 1:1 table uses its foreign key, such as `issue_description (issue_id)`. Both still have `workspace_id`.
- Sort keys for manual ordering come from the `fractional-indexing` package and are `text COLLATE "C"`. Use the `sortKey` column type in `packages/db/src/schema/columns.ts`, and order by the key, then `id`. Postgres's default collations order letter case differently from the SQLite replica and JavaScript.
- Tables have `created_at` and `updated_at` as `timestamptz`. Zero exposes them as milliseconds.
- A calendar date, such as a due date, is a Postgres `date`. Zero exposes it as milliseconds at UTC midnight, and mutators accept only such values.
- Mutators set column values. Avoid database defaults on columns that Zero writes, because they make the columns optional in the Zero schema.
- Never edit a migration that has been applied. Add a new one.
- Every migration must work with the previous version of the app, because open browser tabs still run the previous Zero schema. Expand, then contract: add the new column or table and stop using the old one in one release, and drop or rename the old one in a later release. Never drop or rename a column in the same release that stops using it, even on a single-user instance.
- There are no down migrations. To undo a release, restore a backup.
- Add a table to the `zero_curved` publication in a migration only when clients need it.
- Do not write app queries that join across workspaces.

## Errors

- A mutator throws when the input or permission check fails, so the client rolls back.
- The public API returns errors as `{ "error": { "code": "...", "message": "..." } }`.

## Tests

| Layer       | File name                                  | Runs in                               |
| ----------- | ------------------------------------------ | ------------------------------------- |
| Unit        | `*.test.ts` in `apps/api` and `packages/*` | Node                                  |
| Integration | `*.integration.test.ts`                    | Node, with Postgres                   |
| Web         | `*.test.ts` or `*.test.tsx` in `apps/web`  | Chromium, through Vitest browser mode |
| End-to-end  | `e2e/*.spec.ts`                            | Playwright, against the full stack    |

- Place tests next to the code they cover.
- Every bug fix includes a test that fails without the fix.
- Every mutator has an integration test. Once authentication exists, include a test where permission is denied.
- Test mutators against real Postgres, not a mocked transaction.

## Git and pull requests

- Branch from `main` with `<type>/<short-description>`, such as `feat/issue-board`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.
- Pull requests are squash merged, so the PR title becomes the commit message and must follow Conventional Commits.
- Add a decision record in `docs/decisions/` when a change alters an agreed decision.
