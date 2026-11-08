# Self-hosting

This guide runs Curved on your own machine with Docker Compose. [Decision record 0008](decisions/0008-hosting-deploy-and-release.md) explains the choices behind it.

> [!WARNING]
> Curved has no sign-in yet. Anyone who can open its address can read and change every issue. Until sign-in ships ([0005](decisions/0005-authentication.md)), keep it on `localhost` or a private network such as your tailnet, and never expose it to the internet.

## What runs

Everything is served from one address. Caddy is the only service with published ports.

| Service      | Image           | Role                                                                             |
| ------------ | --------------- | -------------------------------------------------------------------------------- |
| `caddy`      | `caddy`         | Reverse proxy and HTTPS. Sends `/zero/*` to zero-cache and the rest to `curved`. |
| `migrate`    | `curved`        | Applies database migrations, then exits. The others wait for it.                 |
| `curved`     | `curved`        | The API (`/api/*`) and the web app                                               |
| `zero-cache` | `rocicorp/zero` | Syncs data to browsers. Keeps a replica of the database on a volume.             |
| `postgres`   | `postgres:18`   | The database                                                                     |
| `backup`     | `postgres:18`   | Writes a daily database dump to `deploy/backups`                                 |

Until release images are published, Compose builds the `curved` image from this repository.

## Machine size

| Resource | Minimum                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU      | 2 cores                                                                                                                                      |
| Memory   | Estimated 2–4GB. **Not measured yet.** Building the image also needs memory, estimated at about 2GB.                                         |
| Disk     | 20GB free: the database, the zero-cache replica, Postgres WAL (up to `POSTGRES_MAX_SLOT_WAL_KEEP_SIZE`, 10GB by default) and 7 daily backups |

The memory figure is an estimate from [0004](decisions/0004-zero-spike-results.md) until it is measured on a real instance. zero-cache uses the most memory, and its use grows with the number of open browser tabs. Its container has a 2GB limit (`ZERO_MEMORY_LIMIT`) and restarts if it reaches it. To see current use:

```bash
docker stats --no-stream
```

You also need Docker Engine with the Compose plugin (`docker compose`) and git.

## Install

Get the code and create the settings file:

```bash
git clone https://github.com/napatwar/curved.git
```

```bash
cd curved/deploy
```

```bash
cp .env.example .env && chmod 600 .env
```

Fill in `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` and `ZERO_ADMIN_PASSWORD` in `.env`, each with a new value from:

```bash
openssl rand -hex 32
```

Use hex, not base64: the Postgres password goes inside a connection URL, where `+`, `/` and `=` break it. The API refuses to start in production when a secret is missing, shorter than 32 characters, or a development value.

Then choose how you will open Curved (next section), and start it:

```bash
docker compose up -d --build
```

The first build takes several minutes. Check that every service is up and healthy, with `migrate` exited with code 0:

```bash
docker compose ps -a
```

The default settings serve Curved at <http://localhost>.

## Access

Browsers keep the session cookie only on HTTPS or on `localhost`. So other devices need HTTPS, while this machine alone can use plain HTTP on `localhost`.

Two settings in `.env` control this:

- `CURVED_DOMAIN`: the host name people type, without `https://`.
- `CADDY_SITE_ADDRESS`: how Caddy serves it. Leave it empty for Caddy to get a Let's Encrypt certificate for `CURVED_DOMAIN`. An `http://` address or `:80` serves plain HTTP.

After changing `.env`, apply it with `docker compose up -d`.

### This machine only

The defaults:

```dotenv
CURVED_DOMAIN=localhost
CADDY_SITE_ADDRESS=http://localhost
```

### Other devices, through Tailscale

[Tailscale](https://tailscale.com) gives the machine a private address with a `ts.net` HTTPS certificate, with no ports open to the internet. Turn on HTTPS certificates for your tailnet in the Tailscale admin console first.

Let Caddy serve plain HTTP on a local port, and let Tailscale Serve handle HTTPS in front of it:

```dotenv
CURVED_DOMAIN=<machine>.<tailnet>.ts.net
CADDY_SITE_ADDRESS=:80
HTTP_PORT=127.0.0.1:8080
HTTPS_PORT=127.0.0.1:8443
```

`127.0.0.1` keeps the plain HTTP port off your local network. Then run on the machine:

```bash
tailscale serve --bg http://127.0.0.1:8080
```

Open `https://<machine>.<tailnet>.ts.net` from any device on your tailnet. A laptop used as a server must not sleep.

### Other devices, through Cloudflare Tunnel

With a domain on Cloudflare, [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) also needs no open ports. Use the same `.env` as for Tailscale, with your domain in `CURVED_DOMAIN`, and point the tunnel's public hostname at `http://127.0.0.1:8080`. Cloudflare passes WebSockets through by default.

Do not do this until sign-in exists: a tunnel makes Curved public.

### A public server with its own domain

Point the domain's DNS at the server, open ports 80 and 443, and let Caddy get a certificate:

```dotenv
CURVED_DOMAIN=curved.example.com
CADDY_SITE_ADDRESS=
```

### Behind an existing reverse proxy

If Traefik, nginx or another proxy already handles HTTPS on the machine, use the Tailscale settings above and point that proxy at `http://127.0.0.1:8080`. The proxy must pass WebSockets on `/zero/`.

## Upgrade

Until versions are released, upgrading means building a newer commit. Use a commit that passed CI on `main`.

1. Make a backup (see [Backups](#backups)).
2. Get the new code:

   ```bash
   git pull
   ```

3. Compare `deploy/.env.example` with your `.env` and add any new settings.
4. Rebuild and restart:

   ```bash
   docker compose up -d --build
   ```

Migrations run before the API and zero-cache start. If `migrate` fails, the others do not start, and `docker compose logs migrate` shows why.

There are no down migrations. To go back to an older version, check out the older commit, then restore the backup from before the upgrade.

A Postgres major version upgrade, such as 18 to 19, needs a dump and restore. This guide will cover it when the first one is due.

## Backups

The `backup` service runs `pg_dump` every day at `BACKUP_TIME` (03:00 by default, in the `TZ` time zone). It writes `deploy/backups/curved-<date>-<time>.dump` and deletes dumps older than `BACKUP_KEEP_DAYS` (7 by default). Dumps are readable only by their owner, which is `root` on Linux.

To make a backup now, for example before an upgrade:

```bash
docker compose exec backup pg_dump -Fc -f /backups/curved-manual-$(date +%Y%m%d-%H%M%S).dump
```

To check that backups run:

```bash
docker compose logs backup
```

The zero-cache replica is not backed up. It is a cache that zero-cache rebuilds from Postgres.

### Off-site copies

Backups on the same disk are lost with the disk. Copy `deploy/backups` to another place on a schedule. For example, with [restic](https://restic.net) and a cron job as `root`:

```bash
restic -r sftp:backup@nas.local:/srv/restic/curved backup /path/to/curved/deploy/backups
```

Or with [rclone](https://rclone.org) to any cloud storage it supports:

```bash
rclone copy /path/to/curved/deploy/backups remote:curved-backups
```

Also keep a copy of `deploy/.env` somewhere safe, such as a password manager. A restore works without it, but everyone has to sign in again with a new `BETTER_AUTH_SECRET`.

## Restore

This replaces the database with a dump. Everything written after the dump is lost.

1. Stop the services that use the database:

   ```bash
   docker compose stop curved zero-cache
   ```

2. Restore the dump. It must be in `deploy/backups`:

   ```bash
   docker compose exec backup pg_restore --clean --if-exists --single-transaction -d curved /backups/<file>.dump
   ```

3. Delete the zero-cache replica. It no longer matches the restored database:

   ```bash
   docker compose rm -sf zero-cache
   ```

   ```bash
   docker volume rm curved-prod_zero-data
   ```

4. Start everything again. zero-cache copies a new replica from Postgres:

   ```bash
   docker compose up -d
   ```

5. Remove the replication slots the old replica used (see [Rebuild the replica](#rebuild-the-replica)).

On a new machine, install as above, but start only the database first with `docker compose up -d postgres backup`. Copy the dump into `deploy/backups`, run step 2, then `docker compose up -d`.

## Rebuild the replica

Rebuild after a restore, when zero-cache reports a damaged replica, or when a Zero release says to. It took about 16 seconds for 80,000 rows in [0004](decisions/0004-zero-spike-results.md).

```bash
docker compose rm -sf zero-cache
```

```bash
docker volume rm curved-prod_zero-data
```

```bash
docker compose up -d
```

zero-cache 1.11.3 creates a new replication slot and leaves the old one in Postgres, where it keeps WAL files until `POSTGRES_MAX_SLOT_WAL_KEEP_SIZE` is reached. Once `docker compose ps` shows zero-cache as healthy, drop the inactive slots:

```bash
docker compose exec postgres psql -U postgres -d curved -c "select slot_name, pg_drop_replication_slot(slot_name) from pg_replication_slots where slot_name like 'zero\_%' and not active"
```

## Monitoring

There are no alerts. Check these from time to time:

| What                | Command                                              |
| ------------------- | ---------------------------------------------------- |
| Service health      | `docker compose ps -a`                               |
| API and database    | `curl http://localhost/api/health` (or your address) |
| Logs, as JSON lines | `docker compose logs -f curved zero-cache`           |
| Memory and CPU      | `docker stats --no-stream`                           |
| Replica size        | `docker compose exec zero-cache du -sh /data`        |
| Backups             | `ls -l backups`                                      |

Docker rotates each service's logs at 10MB and keeps 5 files. Set `LOG_LEVEL=debug` to also log health checks and web app files.

### Error tracking

Set `SENTRY_DSN` in `.env` to send API errors to [Sentry](https://sentry.io), or to a compatible service you can host yourself, such as [GlitchTip](https://glitchtip.com) or [Bugsink](https://www.bugsink.com). Only the error and its stack trace are sent: no cookies, headers, request bodies or user details.

### Metrics

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to send zero-cache's OpenTelemetry metrics, such as replication lag, to your collector.

## Telemetry

Curved collects no telemetry. zero-cache sends anonymous usage data to Rocicorp by default, so `.env.example` turns it off with `ZERO_ENABLE_TELEMETRY=false`. To help Rocicorp improve Zero, set it to `true`.

## Troubleshooting

| Symptom                                                | Check                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `docker compose` says a variable must be set           | Fill in the secrets in `.env`.                                                                                         |
| `curved` restarts with `invalid environment variables` | `docker compose logs curved` names the setting. Secrets need 32 or more characters and must not be development values. |
| The app shows `disconnected`                           | `docker compose logs zero-cache`. The first start copies the replica and can take a minute.                            |
| Caddy returns an empty page                            | The address you opened does not match `CADDY_SITE_ADDRESS`. Behind another proxy, use `:80`.                           |
| Port 80 or 443 is in use                               | Set `HTTP_PORT` and `HTTPS_PORT` to free ports.                                                                        |
