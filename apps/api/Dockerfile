# syntax=docker/dockerfile:1
#
# Build context is the monorepo ROOT, not this folder:
#   docker build -f apps/api/Dockerfile -t shobukapp-api .

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
# --frozen-lockfile checks the lockfile against every workspace project, so
# every manifest is needed, the web one included.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --child-concurrency=1: extracting hundreds of packages in parallel is what
# brings a small build host down, not the download.
RUN pnpm install --frozen-lockfile --child-concurrency=1 --filter=@shobukapp/api...

COPY apps/api apps/api
# generate is a turbo task, not a prescript of build: without it tsc does not
# find the Prisma client.
RUN pnpm --filter @shobukapp/api generate \
 && pnpm --filter @shobukapp/api build

# A self-contained folder with production dependencies only. --legacy because
# the workspace does not enable inject-workspace-packages.
RUN pnpm --filter @shobukapp/api deploy --prod --legacy /out

# prisma and typescript are optional peers of @prisma/client that pnpm
# resolves because they exist in the workspace. Nothing needs them at runtime:
# the CLI only generated the client, the connection goes through the pg
# adapter. Migrations run from the separate migrate image.
RUN rm -rf /out/node_modules/.pnpm/prisma@* \
           /out/node_modules/.pnpm/typescript@* \
           /out/node_modules/.pnpm/@prisma+studio-core@* \
           /out/node_modules/.pnpm/@prisma+engines@* \
           /out/node_modules/.pnpm/@electric-sql+pglite@* \
           /out/node_modules/.pnpm/effect@* \
           /out/node_modules/.pnpm/elkjs@*

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    STORAGE_DIR=/data/storage
COPY --from=build --chown=node:node /out ./
# Uploads live on a named volume mounted here: Docker copies the ownership of
# this directory into a new volume, so the node user can write to it.
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
