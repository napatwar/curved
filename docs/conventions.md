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
  testing/             Helpers for web tests, such as renderWithRouter
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

## User interface

These rules keep screens consistent. The tokens live in `apps/web/src/index.css`, so change a color or size there, never in a component.

### Look and layout

- Curved follows the structure that Linear users know, not its look. A 240px sidebar holds the workspace menu, My issues, the teams, and Archive, Trash and Settings at the bottom. The main area has a 44px header and content that fills the width. Do not copy Linear's icons, colors, illustrations or wording.
- Below 768px, the sidebar becomes a drawer that the menu button in the header opens.
- With one team, the sidebar shows Issues instead of a Teams section ([0006](decisions/0006-mvp-scope-and-domain-model.md)).

### Density and type

The interface is compact, so a screen shows many issues.

| Element               | Size                                  |
| --------------------- | ------------------------------------- |
| Body text (`text-sm`) | 13px on a 20px line                   |
| Secondary text        | `text-xs`, 12px on a 16px line        |
| Sidebar item          | 28px high (`h-7`)                     |
| List row              | 36px high (`h-9`)                     |
| Page header           | 44px high (`h-11`)                    |
| Button and input      | 32px (`h-8`), 28px when small         |
| Icons                 | 16px (`size-4`), 14px in tight places |

- `index.css` sets `text-sm` to 13/20 and makes it the body size, so shadcn/ui components follow without edits.
- `text-xs` is too tight for Thai stacked marks. Use it only for text we write, such as counts and shortcut hints, never for names, titles or other user text.
- Follow the Thai text rules in [0007](decisions/0007-internationalization.md): `font-bold` at most, no `leading-none` or `leading-tight` on user text, at least 1.6 line height for multi-line text, and room around `truncate`.

### Color and theme

- Colors are OKLCH tokens. Neutrals have a slight blue tint (hue 260). The accent is teal (hue 190), used for primary buttons, focus rings, links and the selected item. It stays clear of the workflow state colors.
- Body text and the primary button meet WCAG AA contrast, 4.5:1, in both themes. Check any new token pair.
- Use semantic tokens such as `bg-background`, `text-muted-foreground` and `bg-primary`, never raw palette colors such as `bg-zinc-100`. Workflow state and label colors come from the data.
- The theme follows the system by default. The workspace menu sets Light, Dark or System, stored per device in `localStorage` (`curved:theme`). A script in `index.html` applies it before the first paint.

### Icons

- Use Lucide (`lucide-react`), the shadcn/ui default, with its default stroke. Icon-only buttons need an `aria-label`.
- Draw state and priority icons as small SVG components of our own, because they show data such as a state's color and category.

### Shared building blocks

- Empty, loading and error states come from `components/` (`EmptyState`, `LoadingState`, `ErrorState`). Zero answers most queries from local data at once, so `LoadingState` waits before it shows anything.
- Format every date and number with `lib/format.ts`.
- Register keyboard shortcuts with `useShortcut` from `hooks/use-shortcut.ts`, never with your own `keydown` listener. The registry gives each shortcut a title, so the command palette can list and run it. Shortcuts match `event.key` and fall back to `event.code` under a Thai layout ([0007](decisions/0007-internationalization.md)).

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
