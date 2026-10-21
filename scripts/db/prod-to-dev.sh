#!/usr/bin/env bash
# Copies the production database to the dev one, anonymized.
# Usage: make db-prod-to-dev (reads SSH_* from .env.local). Details and the
# reasons for each step: docs/deployment.md, Production to dev.
set -euo pipefail

: "${SSH_HOST:?SSH_HOST missing from .env.local}"
SSH_USER="${SSH_USER:-debian}"
SSH_PORT="${SSH_PORT:-22}"
DOCKER="${REMOTE_DOCKER:-docker}"
SQL="$(dirname "$0")/anonymize.sql"

key=()
if [ -n "${SSH_KEY_FILE:-}" ]; then key=(-i "$SSH_KEY_FILE"); fi
# Remote steps are bash scripts on stdin: DOCKER is passed in, the rest of the
# text is never expanded locally.
remote() { ssh "${key[@]}" -p "$SSH_PORT" -o BatchMode=yes "$SSH_USER@$SSH_HOST" "DOCKER='$DOCKER' bash -euo pipefail -s"; }
psql_dev() { echo "\$DOCKER exec -i shobukapp-db-dev psql -v ON_ERROR_STOP=1 -q -U shobukapp $*"; }

echo "This replaces the DEV database with an anonymized copy of PRODUCTION."
read -r -p "Type 'dev' to continue: " answer
[ "$answer" = "dev" ] || { echo "Aborted."; exit 1; }

# Whatever fails, the side database (real data until step 4) is dropped and
# the dev API is started again on whichever database is in place.
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "Failed: cleaning up the dev server." >&2
    remote <<'REMOTE' || echo "Cleanup failed too: check shobukapp_import on the dev server by hand." >&2
q() { $DOCKER exec shobukapp-db-dev psql -U shobukapp -d postgres -tAc "$1"; }
# Interrupted mid-swap: the previous dev database goes back in place.
if [ -z "$(q "SELECT 1 FROM pg_database WHERE datname = 'shobukapp'")" ] \
   && [ -n "$(q "SELECT 1 FROM pg_database WHERE datname = 'shobukapp_previous'")" ]; then
  q 'ALTER DATABASE shobukapp_previous RENAME TO shobukapp'
fi
q 'ALTER DATABASE shobukapp WITH ALLOW_CONNECTIONS true' >/dev/null || true
q 'DROP DATABASE IF EXISTS shobukapp_import WITH (FORCE)'
$DOCKER compose -f /opt/shobukapp/docker-compose.yml up -d api-dev
REMOTE
  fi
}
trap cleanup EXIT

# The copy is restored into a side database and anonymized there: real data
# never sits in the database the dev API serves.
echo "1/6 Fresh side database on dev"
remote <<'REMOTE'
$DOCKER exec shobukapp-db-dev psql -v ON_ERROR_STOP=1 -U shobukapp -d postgres \
  -c 'DROP DATABASE IF EXISTS shobukapp_import WITH (FORCE)' \
  -c 'DROP DATABASE IF EXISTS shobukapp_previous WITH (FORCE)' \
  -c 'CREATE DATABASE shobukapp_import'
REMOTE

# Server side, through a pipe: production rows never transit the workstation.
echo "2/6 Dump production into it"
remote <<'REMOTE'
$DOCKER exec shobukapp-db pg_dump -U shobukapp -d shobukapp -Fc \
  | $DOCKER exec -i shobukapp-db-dev pg_restore -U shobukapp -d shobukapp_import \
      --no-owner --exit-on-error --single-transaction
REMOTE

# Production may be behind dev's schema, and anonymize.sql targets dev's: the
# copy is brought forward first, with dev's own migrate image.
echo "3/6 Dev migrations on the copy"
remote <<'REMOTE'
$DOCKER compose -f /opt/shobukapp/docker-compose.yml --profile tools run --rm --entrypoint sh migrate-dev \
  -c 'export DATABASE_URL="$(printf %s "$DATABASE_URL" | sed "s#/shobukapp?#/shobukapp_import?#")" && exec node_modules/.bin/prisma migrate deploy'
REMOTE

echo "4/6 Anonymize"
{ echo "$(psql_dev -d shobukapp_import) <<'SQL'"; cat "$SQL"; echo "SQL"; } | remote

# Connections are refused before the old database is emptied of its clients:
# a developer's Prisma pool through the tunnel would reconnect at once and the
# rename would fail on "being accessed by other users".
echo "5/6 Swap it in"
remote <<'REMOTE'
$DOCKER compose -f /opt/shobukapp/docker-compose.yml stop api-dev
$DOCKER exec shobukapp-db-dev psql -v ON_ERROR_STOP=1 -U shobukapp -d postgres \
  -c 'ALTER DATABASE shobukapp WITH ALLOW_CONNECTIONS false' \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'shobukapp' AND pid <> pg_backend_pid()" \
  -c 'ALTER DATABASE shobukapp RENAME TO shobukapp_previous' \
  -c 'ALTER DATABASE shobukapp_import RENAME TO shobukapp' \
  -c 'ALTER DATABASE shobukapp WITH ALLOW_CONNECTIONS true'
REMOTE

# The previous dev database is dropped only once the API is healthy on the
# new one. Until then it can be renamed back by hand.
echo "6/6 Restart, then drop the previous dev database"
remote <<'REMOTE'
$DOCKER compose -f /opt/shobukapp/docker-compose.yml up -d --wait api-dev
$DOCKER exec shobukapp-db-dev psql -U shobukapp -d postgres -c 'DROP DATABASE shobukapp_previous WITH (FORCE)'
REMOTE

trap - EXIT
echo "Done. Every account uses the password shobukan-demo; non-admins are 'Membre n' (membre-n@anonyme.invalid)."
