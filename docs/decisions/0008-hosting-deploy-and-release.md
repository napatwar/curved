---
status: accepted
date: 2026-11-09
---

# Hosting, deploy and release

## Context and problem statement

Curved has no production build, container image or deployment yet. We need to decide how it is built, packaged, deployed, backed up, observed and released.

Constraints:

- Cloud is the main long-term target. Self-hosting serves one person up to teams of tens, using Docker.
- [0005](0005-authentication.md) requires the web app, API and zero-cache to share one site, so the `SameSite=Lax` session cookie reaches zero-cache. SMTP is optional.
- [0001](0001-tech-stack.md) asks for a replica size alert at 50GB, and [0004](0004-zero-spike-results.md) asks for a zero-cache memory limit and monitoring. 0004 also measured about 4.7GB of zero-cache memory with 50 clients, and all 12 cores busy for about 10 seconds when every client reconnects.
- Postgres needs logical replication and event triggers. Without event triggers, Zero resets all server and client state on every schema change.
- There is one maintainer, who prefers low long-term maintenance.

During the MVP, Curved is self-hosted and used by the maintainer alone. The cloud provider is chosen after the MVP, because the cost figures below are rough estimates and cost options need more time to evaluate.

## Considered options

- Cloud shape: a managed container platform (Fly.io) with managed Postgres, AWS (ECS Fargate and RDS), a VM running Docker Compose, Rocicorp's Cloud Zero with another host for the API, GCP only (Cloud Run, Compute Engine and Cloud SQL), or Kubernetes. See [Cloud options](#cloud-options).
- API build: an esbuild bundle, tsdown, `tsx` in production, or `tsc` output with Node's type stripping.
- Images: one image for the web app and API, or separate images.
- Domain layout: one origin with path routing, or subdomains.
- Reverse proxy: Caddy, Traefik, or nginx with certbot.
- Backups: a daily `pg_dump`, point-in-time recovery with pgBackRest or WAL-G, or host volume snapshots.
- Release tool: release-please, semantic-release, changesets, or manual tags with git-cliff.
- Image registry: GitHub Container Registry (GHCR) or Docker Hub.
- Live demo: a long-lived `live-demo` branch, or a demo mode setting on `main`.

## Decision outcome

Chosen option: build for self-hosting first. Ship one `curved` image and a Docker Compose file that puts every service behind Caddy on one origin. Defer the cloud provider, preview and staging environments, and release automation until they are needed.

This keeps the work for the MVP to what the maintainer's own instance needs, and nothing here blocks any cloud option.

### Build and images

- The API is bundled with esbuild. The bundle includes our code and the `@curved/*` packages. npm dependencies stay external and are installed in the image with `pnpm deploy --prod --filter @curved/api`, which avoids packages that break when bundled.
- One image, `curved`, holds the API bundle, the web app's `dist`, the migrations and the CLI commands, such as the password reset from 0005. The API serves the web app's static files and falls back to `index.html` for client routes.
- The image is based on `node:24-slim` and runs as a non-root user.
- zero-cache uses the official `rocicorp/zero` image and Postgres uses the official `postgres:18` image, with no custom images.
- The web app reads the zero-cache URL at runtime, defaulting to `${location.origin}/zero`, so one image works on any domain. `VITE_ZERO_CACHE_URL` stays as an override for development.

### Self-host layout

One origin serves everything:

| Path      | Service                 |
| --------- | ----------------------- |
| `/`       | Web app, from `curved`  |
| `/api/*`  | API, from `curved`      |
| `/zero/*` | zero-cache, port `4848` |

Zero 1.11.3 supports this without rewriting paths. The client accepts a `cacheURL` with one path segment, and zero-cache routes requests on `(/:base)/:worker/v:version/:action`.

The session cookie is host-only, with no `Domain` attribute and `SameSite=Lax`. This meets 0005's same-site rule more strictly. The subdomain layout in 0005, such as `app.` and `sync.`, remains an option for cloud.

The production Compose file has these services:

| Service      | Image           | Role                                                                                                                       |
| ------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `caddy`      | `caddy`         | The only service with published ports (80 and 443). Gets TLS certificates from Let's Encrypt and proxies WebSockets.       |
| `migrate`    | `curved`        | Runs migrations once and exits. `curved` and `zero-cache` start only after it succeeds (`service_completed_successfully`). |
| `curved`     | `curved`        | API and web app                                                                                                            |
| `zero-cache` | `rocicorp/zero` | Keeps its replica on a volume                                                                                              |
| `postgres`   | `postgres:18`   | Runs with `wal_level=logical` and `max_slot_wal_keep_size`. No published port.                                             |
| `backup`     | `postgres:18`   | Writes a daily `pg_dump` (see below)                                                                                       |

- Configuration is in a `.env` file next to the Compose file: `CURVED_DOMAIN`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `ZERO_ADMIN_PASSWORD`, and the SMTP or OAuth settings a deployment turns on.
- With `CURVED_DOMAIN=localhost`, one person can run Curved on their own machine. Browsers treat `localhost` as a secure context, so `Secure` cookies work there.
- Other devices need HTTPS, because a plain HTTP address other than `localhost` cannot keep `Secure` cookies. A machine at home can use Tailscale with its `ts.net` certificate, or a domain through Cloudflare Tunnel, without opening ports to the internet. During the MVP, the maintainer's instance runs on a spare laptop and is reached from other devices this way.
- A deployment that already has a reverse proxy, such as Traefik or Cloudflare Tunnel, sets Caddy to plain HTTP and points its proxy at Caddy. Either way there is one upstream.
- zero-cache defaults suit a small machine: a low `ZERO_NUM_SYNC_WORKERS`, such as 2, a memory limit, and a restart policy. zero-cache forwards cookies to the API with `ZERO_QUERY_FORWARD_COOKIES` and `ZERO_MUTATE_FORWARD_COOKIES`.
- The Compose file lives in the repository and pins the `curved` and `rocicorp/zero` versions together, so zero-cache always matches `@rocicorp/zero`, as 0003 requires.
- Upgrade: get the Compose file for the new version, then run `docker compose pull` and `docker compose up -d`. Migrations run before the app starts. There are no down migrations. To roll back, restore a backup.
- A Postgres major version upgrade, such as 18 to 19, needs a dump and restore. Document it when the first one is due.

### Migrations, backups and the replica

Migrations:

- The `migrate` service runs `drizzle-orm`'s migrator at runtime, against the migration files copied into the image. Production does not need `drizzle-kit`.
- Event triggers let zero-cache apply schema changes without a reset, as 0004 confirmed.
- Every migration must work with the previous version of the app. Use expand, then contract: add the new column and stop using the old one in one release, and drop the old column in a later release. Open browser tabs still run the previous Zero schema, so dropping or renaming a column in one step breaks them, even on a single-user instance.

Backups:

- The `backup` service uses the `postgres:18` image, so `pg_dump` always matches the server version. It runs `pg_dump -Fc` once a day into a `./backups` bind mount and keeps 7 days by default, configurable by an environment variable.
- Copying backups off the machine, for example with rclone or restic, is the operator's job. The self-hosting guide explains how.
- The zero-cache replica is not backed up. It is a cache that zero-cache rebuilds from Postgres.

Restore: stop `curved` and `zero-cache`, run `pg_restore --clean`, delete the replica volume, then start again. The old replica and replication slot no longer match the restored database, so the replica must be rebuilt. Confirm that clients resync on their own when this is implemented.

Replica rebuild: stop zero-cache, delete its volume and start it. 0004 measured about 16 seconds at 80,000 rows and a copy rate of about 200MB per second. Rebuild after a restore, when the replica is damaged, or when a Zero release says to.

`max_slot_wal_keep_size`, such as 10GB, stops a stopped zero-cache from filling the Postgres disk. Without it, the replication slot keeps every WAL file until zero-cache returns. With it, Postgres drops the slot when the limit is reached, and zero-cache rebuilds its replica when it starts.

### Observability

| Area           | Self-host, now                                                                                                                                                                                              | Cloud, deferred                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Logs           | The API writes JSON logs to stdout. zero-cache sets `ZERO_LOG_FORMAT=json`. Read them with `docker compose logs`. The Compose file sets Docker log rotation.                                                | Forward to the provider's log service                                                          |
| Error tracking | Optional Sentry SDK, off unless `SENTRY_DSN` is set. It works with Sentry or with Sentry-compatible services that can be self-hosted, such as GlitchTip or Bugsink.                                         | Choose with the provider                                                                       |
| Metrics        | No metrics stack. Health checks only: `/api/health`, which checks the database, and zero-cache's `/keepalive`. OpenTelemetry settings (`OTEL_EXPORTER_OTLP_ENDPOINT`) pass through for those who want them. | zero-cache's OpenTelemetry metrics, including replication lag, sent to the chosen backend      |
| Alerts         | None. A single user does not reach these limits. The memory limit and restart policy cover zero-cache, and the guide shows how to check the replica size.                                                   | Replica size at 50GB, zero-cache memory above about 80% of its limit, and high replication lag |
| Telemetry      | Off by default. zero-cache 1.11.3 sends anonymous usage data to Rocicorp unless told not to, so the Compose file sets `ZERO_ENABLE_TELEMETRY=false`. Curved collects no telemetry.                          | –                                                                                              |

Self-hosters of open-source software expect no data to leave their server without their knowledge. The guide explains how to turn zero-cache's telemetry back on to help Rocicorp.

### Releases and versioning

During the MVP there is no release automation:

- The Compose file can build the image from source with `build: .`. Others can clone the repository and run it with only git and Docker, because the multi-stage Dockerfile builds everything inside Docker. Building needs several minutes and about 2GB of memory.
- The maintainer tags versions by hand when needed.

The target process, to set up at the first public release (`0.1.0`) or when someone else starts self-hosting:

- release-please (`googleapis/release-please-action`, pinned by SHA) opens a release pull request from the Conventional Commits on `main`, with the version bump and `CHANGELOG.md`. Merging it creates the tag and the GitHub Release. It can build the changelog from existing history.
- The whole product has one version, because every package in the monorepo is private. Versions follow SemVer and start at `0.x`. Before 1.0, a breaking change bumps the minor version. A breaking change is anything a self-hoster must act on when upgrading, such as a renamed environment variable or a manual upgrade step.
- A workflow publishes `ghcr.io/napatwar/curved` on each GitHub Release, tagged `X.Y.Z`, `X.Y` and `latest`. The Compose file always pins `X.Y.Z`.
- Images are built for amd64 and arm64 on native GitHub runners (`ubuntu-24.04-arm` is free for public repositories), with the provenance and SBOM attestations that `docker/build-push-action` provides.
- The release attaches `docker-compose.yml`, `Caddyfile` and `.env.example`. release-please updates the image tag in the Compose file through `extra-files`.
- Release pull requests created with `GITHUB_TOKEN` do not trigger CI. Accept this, because they change only the version and changelog. A personal access token would avoid it but adds a credential that expires.

GHCR, because the workflow signs in with `GITHUB_TOKEN`, so there is no second account or token to maintain, and public images have no published pull limit. Docker Hub limits pulls without sign-in (100 per 6 hours per IP address in its current documentation), and needs its own account and token. Pushing to Docker Hub as well can be added to the same workflow later if discovery there matters.

The estimated setup is half a day to a day, with little ongoing work beyond updating pinned action SHAs.

### Environments and secrets

| Environment              | Where                                                                                                    | Status                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| Development              | The maintainer's machine: `docker-compose.yml` for Postgres and zero-cache, API and web on the host      | Exists                  |
| CI                       | GitHub Actions                                                                                           | Exists                  |
| Production (self-hosted) | The maintainer's own instance, from the production Compose file                                          | Built during the MVP    |
| Live demo                | The maintainer's spare laptop, a separate Compose project in demo mode, reached through Tailscale Funnel | Built during the MVP    |
| Preview and staging      | –                                                                                                        | Deferred with the cloud |

The maintainer's instance is where the self-hosted release gets tested in practice. Upgrade it only to commits or tags that passed CI, so upgrade and migration problems appear there first.

Secrets:

- Development uses `.env`, copied from `.env.example`, with development-only values.
- Self-hosting keeps secrets in `.env` next to the Compose file, readable only by its owner (`chmod 600`). The guide generates them with `openssl rand -base64 32`.
- `env.ts` validates every secret with Zod at startup. In production, the API refuses to start when a secret is missing, too short, or a development value such as `dev-only` or `pass`.
- Secrets are plain environment variables. Docker secrets through `*_FILE` variables wait until someone asks.
- CI needs no secrets yet beyond `GITHUB_TOKEN`.
- Turn on GitHub secret scanning and push protection for the repository. Both are free for public repositories.
- Cloud secrets go in the chosen provider's secret manager.

### Live demo

The maintainer wants a public demo for a portfolio, so people such as recruiters can try Curved without signing up.

Demo mode is a setting on `main`, `CURVED_DEMO=true`, not a long-lived `live-demo` branch. A branch would fall behind `main`, collect merge conflicts, skip CI and break 0002's rule of short-lived branches. A setting ships in the same image and is tested on every pull request.

In demo mode:

- A demo account with sample data exists, and the sign-in page offers it, for example with a "Try the demo" button or filled-in credentials.
- The demo account is a workspace `member`. Its credentials are public, so the instance admin is a separate account that only the maintainer knows.
- A `demo:reset` command restores the sample data on a schedule, such as nightly, because every visitor shares the account and sees what the previous one wrote.
- Features that can be abused are off: changing the password, sending email, invitations, creating workspaces and file uploads.
- A short hint suggests opening two tabs to watch changes sync.

The demo runs as its own Compose project, with its own name and volumes, so it never shares a database with the maintainer's personal instance. Tailscale Funnel makes it public at a `ts.net` address without a domain or open ports. Visitors do not need Tailscale.

Risks: Funnel is in beta and has bandwidth limits that cannot be configured, which is enough for a few visitors. A laptop that sleeps takes the demo down, so keep it awake and use a free uptime check to alert the maintainer. Move the demo to a VPS or the cloud when the cloud provider is chosen, if it needs to be more reliable.

### Keeping cloud options open

Until the cloud provider is chosen, development must not close any option:

- Do not depend on a Postgres extension or superuser-only feature that managed providers lack. Check `kham_pg`, the candidate for Thai search in 0001, against the cloud candidates before using it.
- Keep the API stateless and configured only through environment variables. Only zero-cache needs a disk.
- Store file attachments, when they exist, through an interface that can use S3-compatible storage, not only a local disk.
- Handle `SIGTERM` in the API and finish in-flight requests, so rolling deploys and `docker compose` restarts do not drop them.

### Consequences

- Good, because the MVP needs only one image, one Compose file and one domain, and the maintainer's own instance tests what other self-hosters will run.
- Good, because one origin removes cookie `Domain` settings and cross-origin setup, and works on `localhost`.
- Good, because migrations run before the app on every start, and backups need no third-party image.
- Good, because self-hosted instances send no telemetry by default.
- Good, because nothing here locks in a cloud provider, and the release process can start later by adding workflows to the existing Dockerfile.
- Bad, because until release automation exists, others must build from source, which is slow on small machines and has no changelog.
- Bad, because a daily `pg_dump` can lose up to a day of data, and off-site copies are left to the operator.
- Bad, because the expand-then-contract rule makes some schema changes take two releases.
- Bad, because self-hosted instances have no alerts, so an operator learns about problems from logs or users.
- Neutral, because the API serves the web app's static files. This is a small load at this scale, and a CDN can take over on cloud.

## More information

### Cloud options

Deferred until after the MVP. Prices were checked on 2026-11-08 and 2026-11-09. They are rough estimates for a first small deployment, and some come from third-party price lists.

Where web, API and zero-cache run:

| Option                                                                                                                                | Estimated cost to start                         | Maintenance                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fly.io and PlanetScale Postgres in the same region                                                                                    | About $55–85 a month                            | Low: no OS to maintain, TLS and rolling deploys included | Runs the same images as self-hosting. zero-cache runs on one Machine with a volume ($0.15/GB a month) and rebuilds its replica from Postgres if the volume is lost. Fly.io raised RAM to $6/GB a month on 2026-10-01. Was the recommendation before the decision was deferred.                                                                                                                                                                                                                                                                                                                                                                                                              |
| AWS: ECS Fargate and RDS, following Zero's SST example                                                                                | About $100+ a month                             | Medium to high: VPC, load balancer, IAM                  | Strongest path to scaling and cells, but a lot of setup for one maintainer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A VM, such as Hetzner or DigitalOcean, running Docker Compose                                                                         | About $20–40 a month                            | Medium: OS updates, backups, no failover                 | Reuses the self-host Compose file. Hetzner raised prices twice in 2026, by more than double for some types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Cloud Zero (Rocicorp) for zero-cache, with another host for the API                                                                   | Plus $30 (Hobby) or $300 (Professional) a month | zero-cache run by Rocicorp                               | Its documentation does not say whether a custom domain, such as `sync.example.com`, is possible, which 0005's cookie rule needs. It adds vendor dependence, and self-hosting still needs zero-cache knowledge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| GCP only: Cloud Run for web and API, a Compute Engine VM with a persistent disk for zero-cache, Cloud SQL, and an HTTPS load balancer | About $120–150 a month                          | Medium: one VM, VPC, load balancer, IAM                  | zero-cache cannot run on Cloud Run: it has no persistent disk, SQLite on Cloud Storage FUSE is unsafe, WebSockets end at the request timeout of at most 60 minutes, and every new instance rebuilds the replica. Run zero-cache on Container-Optimized OS in a managed instance group of size 1 with a stateful disk, or on GKE Autopilot with Zero's Kubernetes example. One vendor for billing, IAM, logs, error reporting and secrets, with a Singapore region and startup credits. Zero has no GCP example. Estimate in Singapore: VM e2-standard-2 about $60, Cloud SQL db-g1-small about $36 (shared core, no SLA), load balancer about $18, Cloud Run and disk about $10–15 a month. |
| Kubernetes                                                                                                                            | High                                            | High                                                     | Rejected for this stage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Postgres providers:

| Provider                | Event triggers                            | Failover with Zero                                     | Notes                                                                                                                    |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| PlanetScale Postgres    | Yes                                       | Yes, with `ZERO_UPSTREAM_PG_REPLICATION_SLOT_FAILOVER` | PS-10 is $10 a month on a single node or $30 with high availability. Regions include Singapore, us-east-1 and Frankfurt. |
| AWS RDS                 | Yes                                       | Multi-AZ                                               | Costs more and needs AWS                                                                                                 |
| Google Cloud SQL        | Yes, through the `cloudsqlsuperuser` role | Not documented by Zero                                 | Turn on logical decoding with the `cloudsql.logical_decoding` flag                                                       |
| Neon                    | Not documented by Zero                    | –                                                      | zero-cache keeps a connection open, so compute never scales to zero, about $78 a month for 1 CU                          |
| Fly.io Managed Postgres | No                                        | –                                                      | Rejected                                                                                                                 |
| Render                  | No                                        | No                                                     | Rejected                                                                                                                 |
| Supabase                | Yes, from 15.8.1.083                      | No                                                     | Rejected                                                                                                                 |

A region is also still to choose: Singapore suits Thai and Southeast Asian users first, and us-east suits a global audience.

When choosing the cloud provider, also decide error tracking, the alert thresholds above, preview and staging environments, secret storage, point-in-time recovery for Postgres, and Litestream backups of the replica to S3 once zero-cache is split into a replication manager and view-syncers.

Sources: [Zero deployment](https://zero.rocicorp.dev/docs/deployment), [Zero and Postgres providers](https://zero.rocicorp.dev/docs/connecting-to-postgres), [Cloud Zero pricing](https://zero.rocicorp.dev/), [Fly.io pricing](https://docs.fly.io/about/pricing), [PlanetScale pricing](https://planetscale.com/pricing), [PlanetScale event triggers](https://planetscale.com/changelog/event-triggers), [RDS event triggers](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.EventTriggers.html), [Cloud SQL roles](https://docs.cloud.google.com/sql/docs/postgres/users), [Cloud Run WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets), [Neon pricing](https://neon.com/pricing), [Hetzner 2026 price increases](https://northflank.com/blog/hetzner-cloud-server-price-increases), [Docker Hub pull limits](https://docs.docker.com/docker-hub/usage/pulls/), [arm64 runners for public repositories](https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/).

### Follow-up work

For the MVP:

- A multi-stage Dockerfile for `curved`, the esbuild bundle, static file serving with the `index.html` fallback, and a `migrate` command using `drizzle-orm`'s migrator.
- The production Compose file, `Caddyfile` and `.env.example`, with the services, settings and defaults above.
- The web app's default `cacheURL` of `${location.origin}/zero`.
- `/api/health`, JSON logs, `SIGTERM` handling, the optional Sentry SDK, and production secret checks in `env.ts`.
- Add the expand-then-contract rule to [conventions.md](../conventions.md).
- A CI job that builds the `curved` image on every pull request without pushing it, because others build from source during the MVP. Run some end-to-end tests against the production Compose file, to check the `/zero` routing and the cookie.
- A self-hosting guide: minimum machine size, install, access from other devices, upgrade, backup, off-site copies, restore and replica rebuild. Measure the minimum size on the maintainer's instance. The estimate is 2–4GB of memory, not yet measured.
- Test a restore and a replica rebuild on the maintainer's instance, and confirm that clients resync.
- Turn on GitHub secret scanning and push protection.
- Demo mode (`CURVED_DEMO`), its sample data and `demo:reset` command, a Compose setup for the demo, and its Tailscale Funnel and uptime check. Confirm that zero-cache's WebSocket works through Funnel.

Later:

- At the first public release: release-please, image publishing to GHCR and release assets.
- After the MVP: choose the cloud provider and region, and the cloud items listed above.
