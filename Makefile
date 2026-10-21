# Shortcuts for the monorepo. Nothing here is required: everything stays doable
# with pnpm. Recipes needing the server read .env.local (see .env.local.example).

SHELL := /bin/bash
.DEFAULT_GOAL := help
ENV_LOCAL := .env.local

# Sourced by the shell, not `include`d by make: make would treat # as a comment
# and expand $ itself, silently mangling a value that contains one. set -e: a
# malformed line would otherwise run as a command and the load would go on.
REQUIRE_ENV = if [ ! -f $(ENV_LOCAL) ]; then \
		echo "$(ENV_LOCAL) is missing: create it from .env.local.example." >&2; \
		exit 1; \
	fi
LOAD_ENV = set -ae && . ./$(ENV_LOCAL) && set +ae

.PHONY: help dev check tunnel db-dev-migrate db-prod-to-dev

help: ## List targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

dev: ## Web (3000) and api (3001) in watch mode (open `make tunnel` first)
	pnpm dev

check: ## Typecheck, lint, build and both API test suites
	pnpm typecheck && pnpm lint && pnpm build \
		&& pnpm --filter @shobukapp/api test && pnpm --filter @shobukapp/api test:e2e

# The server publishes the dev Postgres on its loopback only, hence 127.0.0.1
# on the remote side. DATABASE_URL in apps/api/.env targets the local end.
tunnel: ## SSH tunnel to the dev Postgres (localhost:15433), Ctrl+C to close
	@$(REQUIRE_ENV); $(LOAD_ENV); \
	if [ -n "$$SSH_KEY_FILE" ]; then key=(-i "$$SSH_KEY_FILE"); else key=(); fi; \
	echo "Tunnel to $$SSH_HOST: dev Postgres on localhost:$${PG_DEV_LOCAL_PORT:-15433}. Ctrl+C to close."; \
	ssh -N "$${key[@]}" \
		-p "$${SSH_PORT:-22}" \
		-o ExitOnForwardFailure=yes \
		-o ServerAliveInterval=30 \
		-L "$${PG_DEV_LOCAL_PORT:-15433}:127.0.0.1:$${PG_DEV_REMOTE_PORT:-15433}" \
		"$${SSH_USER:-debian}@$$SSH_HOST"

# The local API runs new code against the dev database: its schema has to
# follow before the next dev deploy does it. Through the open tunnel.
db-dev-migrate: ## Apply pending migrations to the dev database (tunnel open)
	@cd apps/api && LOCAL_DATABASE_URL= pnpm exec prisma migrate deploy

db-prod-to-dev: ## Replace the dev database with an anonymized copy of production
	@$(REQUIRE_ENV); $(LOAD_ENV); ./scripts/db/prod-to-dev.sh
