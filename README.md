# Curved

An open-source task management tool for teams, with Linear as its reference product.

Curved is at a very early stage. It currently has one `issue` table and no authentication, so run it only on a trusted network.

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
| `deploy`        | Production Compose file, `Caddyfile` and settings for self-hosting     |

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

Open <http://localhost:5173>. `pnpm infra:up` starts Postgres, applies migrations, adds seed data and starts `zero-cache`.

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
| `pnpm test:e2e:prod`    | Run end-to-end tests against the production stack  |
| `pnpm build`            | Build the web app and the API bundle               |
| `pnpm db:generate`      | Create a migration from `packages/db/src/schema`   |
| `pnpm db:migrate`       | Apply migrations                                   |
| `pnpm zero:generate`    | Regenerate the Zero schema from the Drizzle schema |
| `pnpm infra:down`       | Stop Postgres and `zero-cache`                     |

Web and end-to-end tests need Chromium once:

```bash
pnpm exec playwright install chromium
```

Integration tests use a `curved_test` database in the same Postgres. Set `TEST_DATABASE_URL` to use another one.

`pnpm zero:generate` warns that `issue.id` has a database default. This is expected because mutators always send an `id`.

## Self-hosting

See [the self-hosting guide](docs/self-hosting.md). It runs the `curved` image, Postgres, `zero-cache` and Caddy with Docker Compose.

## License

Curved is licensed under [AGPL-3.0-only](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.
