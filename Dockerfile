# syntax=docker/dockerfile:1

# The `curved` image: the API bundle, the web app's static files and the
# database migrations. See docs/decisions/0008-hosting-deploy-and-release.md.
#
#   docker build -t curved:local .
#
# Commands:
#   node dist/server.js    API and web app on port 3000 (default)
#   node dist/migrate.js   Applies pending migrations and exits

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm's version comes from packageManager in package.json.
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Install dependencies before copying the source, so a source change reuses
# this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/zero/package.json packages/zero/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

COPY . .
RUN pnpm --filter @curved/web build \
 && pnpm --filter @curved/api build

# Install only the API's runtime npm packages. The @curved/* packages are
# devDependencies of the API because the bundle already contains them.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @curved/api deploy --prod --store-dir /pnpm/store /out
# @rocicorp/zero depends on zero-sqlite3, which ships binaries for every
# platform (about 95MB). Keep only this platform's.
RUN arch="linux-$(node -p process.arch)" \
 && for dir in /out/node_modules/.pnpm/@rocicorp+zero-sqlite3@*/node_modules/@rocicorp/zero-sqlite3/prebuilds/*; do \
      [ "${dir##*/}" = "$arch" ] || rm -rf "$dir"; \
    done

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps \
    API_PORT=3000 \
    WEB_DIST_DIR=/app/web \
    MIGRATIONS_DIR=/app/migrations
WORKDIR /app

# Files stay owned by root, so the app cannot change its own code.
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/web/dist ./web
COPY --from=build /repo/packages/db/migrations ./migrations

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
