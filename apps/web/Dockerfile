# syntax=docker/dockerfile:1
#
# Build context is the monorepo ROOT:
#   docker build -f apps/web/Dockerfile -t shobukapp-web .

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --child-concurrency=1 --filter=@shobukapp/web...

COPY apps/web apps/web

# Baked into the routes manifest by next build: see next.config.ts. Both
# copies of the stack give their API this alias on their own internal network,
# so one value serves prod and dev. Not `api`: Compose names every service
# after itself on every network, and another stack's `api` on traefik-public
# would answer first, cookies included.
ARG API_URL=http://shobukapp-api-internal:3001
ENV API_URL=$API_URL
RUN pnpm --filter @shobukapp/web build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_URL=http://shobukapp-api-internal:3001

# output: standalone keeps the workspace layout: the server lands in apps/web/.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
