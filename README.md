# Curved

An open-source task management tool for teams, with Linear as its reference product.

Curved is at a very early stage. It has sign-in and workspaces, and an `issue` table from the Zero spike.

## Stack

- **Web:** React, TypeScript, Vite, TanStack Router, Tailwind CSS, shadcn/ui
- **Sync:** Zero
- **API:** Node.js, Hono
- **Data:** Postgres 18, Drizzle

See [the decision records](docs/decisions/README.md) for the reasoning and limits, and [the conventions](docs/conventions.md) for how the code is organized.

## Project layout

| Path            | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `apps/web`      | Browser app                                                            |
| `apps/api`      | REST API and the Zero query and mutate endpoints                       |
| `packages/db`   | Drizzle schema, migrations and seed data                               |
| `packages/zero` | Generated Zero schema, plus queries and mutators shared by web and API |
| `test`          | Shared test setup                                                      |
| `e2e`           | End-to-end tests                                                       |

## Getting started

You need Node.js 24, pnpm 12 and Docker.

```bash
cp .env.example .env
```

```bash
pnpm install
```

```bash
pnpm infra:up
```

```bash
pnpm dev
```

Open <http://localhost:5173> and sign in as `dev@example.com` with the password `curved-dev-password`. `pnpm infra:up` starts Postgres, applies migrations, adds seed data and starts `zero-cache`. The seed creates this user as the instance admin, with a workspace called Curved.

On a new instance without seed data, the first person to sign up becomes the instance admin and sign-up then closes. Others join by invitation. See `apps/api/src/env.ts` for the sign-in options, such as Google, GitHub and SMTP.

If an instance has no SMTP, an instance admin resets a password with:

```bash
pnpm --filter @curved/api auth:reset-password person@example.com
```

## Common commands

| Command                 | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `pnpm check`            | Check formatting, lint, types and run Vitest tests |
| `pnpm format`           | Format all files                                   |
| `pnpm lint:fix`         | Fix lint problems that can be fixed automatically  |
| `pnpm test:unit`        | Run unit tests                                     |
| `pnpm test:integration` | Run integration tests against Postgres             |
| `pnpm test:web`         | Run web tests in Chromium                          |
| `pnpm test:e2e`         | Run end-to-end tests; needs `pnpm infra:up`        |
| `pnpm db:seed`          | Add the development user, workspace and issue      |
| `pnpm build`            | Build the web app                                  |
| `pnpm db:generate`      | Create a migration from `packages/db/src/schema`   |
| `pnpm db:migrate`       | Apply migrations                                   |
| `pnpm zero:generate`    | Regenerate the Zero schema from the Drizzle schema |
| `pnpm infra:down`       | Stop Postgres and `zero-cache`                     |

Web and end-to-end tests need Chromium once:

```bash
pnpm exec playwright install chromium
```

Integration tests use a `curved_test` database in the same Postgres. Set `TEST_DATABASE_URL` to use another one.

`WEB_PORT` and `API_PORT` let `pnpm test:e2e` run a second stack next to `pnpm dev`, for example from another worktree with its own database and `zero-cache`.

`pnpm zero:generate` warns that `issue.id` has a database default. This is expected because mutators always send an `id`.

## License

Curved is licensed under [AGPL-3.0-only](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.
