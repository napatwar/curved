# Curved

An open-source task management tool for teams, with Linear as its reference product.

Curved is at a very early stage. It currently has one `issue` table and no authentication, so run it only on a trusted network.

## Stack

- **Web:** React, TypeScript, Vite, TanStack Router, Tailwind CSS, shadcn/ui
- **Sync:** Zero
- **API:** Node.js, Hono
- **Data:** Postgres 18, Drizzle

See [the tech stack decision](docs/decisions/0001-tech-stack.md) for the reasoning and limits.

## Project layout

| Path | Purpose |
|---|---|
| `apps/web` | Browser app |
| `apps/api` | REST API and the Zero query and mutate endpoints |
| `packages/db` | Drizzle schema, migrations and seed data |
| `packages/zero` | Generated Zero schema, plus queries and mutators shared by web and API |

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

| Command | Purpose |
|---|---|
| `pnpm typecheck` | Check types in every package |
| `pnpm build` | Build the web app |
| `pnpm db:generate` | Create a migration from `packages/db/src/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm zero:generate` | Regenerate the Zero schema from the Drizzle schema |
| `pnpm infra:down` | Stop Postgres and `zero-cache` |

`pnpm zero:generate` warns that `issue.id` has a database default. This is expected because mutators always send an `id`.

When a new table should sync to clients, add it to the `zero_curved` publication in a migration.

## License

Curved is licensed under [AGPL-3.0-only](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.
