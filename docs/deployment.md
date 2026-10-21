# Deployment

One OVH server, managed in `iac-journey` (Ansible role `shobukapp`), same pattern as OdyssAI. Two copies of the stack in `/opt/shobukapp`: production from `main`, staging from `dev`.

| | Production | Staging |
|---|---|---|
| Site | https://shobukapp.joachimjasmin.com | https://shobukapp-dev.joachimjasmin.com (basic auth) |
| Images | `jyok1m/shobukapp-{api,web,migrate}:main` | `:dev` |
| Postgres | `shobukapp-db`, loopback `5433` | `shobukapp-db-dev`, loopback `15433` |
| `APP_ENV` | `production` (test and live Stripe pairs, switched in the dashboard) | `staging` (test pair only) |
| Backups | daily `pg_dump` to OVH S3 (`shobukapp` bucket) | none |

## Pipeline

GitHub Actions (`.github/workflows/trigger_jenkins.yml`) triggers the Jenkins job `apps/shobukapp` on every push to `dev` or `main`. The `Jenkinsfile`:

1. **Test**, on every branch: install, typecheck and lint, unit tests, then e2e against a throwaway Postgres container on a per-build Docker network (migrations applied first).
2. **Build** (`dev`, `main`): migrate, api, web images for `linux/amd64`, sequentially (memory).
3. **Publish** to Docker Hub with the `dockerhub-credentials` Jenkins credential.
4. **Deploy** over SSH (`host-ssh-key`, `host-ssh-port`): `pull`, then `compose run --rm migrate` (or `migrate-dev`), then `up -d` of the copy's services. The schema always lands before the API that expects it.

## Images

- `apps/api/Dockerfile`: `pnpm deploy --prod` of the api, Prisma CLI and engines removed (about 190 MB), `node dist/src/main.js`. `package.json` declares `"files": ["dist"]`: without it `pnpm deploy` honours `.gitignore` and ships no `dist`.
- `apps/api/Dockerfile.migrate`: Prisma CLI, schema and migrations only; runs `prisma migrate deploy` and exits. Lives in the compose `tools` profile.
- `apps/web/Dockerfile`: Next `output: "standalone"`, server at `apps/web/server.js`.

## Traps

- **There is no public API host.** `api.shobukapp.joachimjasmin.com` would be two labels under the zone, outside the proxied wildcard and Cloudflare's edge certificate. The browser reaches the API through the web's `/api/*` rewrite, Stripe too.
- **The rewrite target is baked at build time** (routes manifest). The web image uses `http://shobukapp-api-internal:3001`, an alias each copy gives its API on its own internal network. Not `api`: Compose names every service after itself on every network, and OdyssAI's `api` on the shared `traefik-public` network would answer, session cookies included.
- **Stripe webhooks**: `https://shobukapp.joachimjasmin.com/api/billing/webhook` and `https://shobukapp-dev.joachimjasmin.com/api/billing/webhook`. The rewrite streams the body untouched, so the signature holds. On staging, Traefik exempts this exact path from basic auth (Stripe cannot answer a challenge).
- **Uploads** live on the named volumes `shobukapp-storage-data` / `shobukapp-storage-dev-data` mounted at `/data/storage` (`STORAGE_DIR`). They are **not** covered by the Postgres backup yet.
- **Mail**: mailcow submission, `mail.joachimjasmin.com:587` with STARTTLS, mailbox `no-reply@joachimjasmin.com` for both copies (password from `vaults/mailcow.yml`). The sender must be that mailbox or mailcow refuses it.
- `DATABASE_URL` is rendered with the password URL-encoded: a generated password may contain `/`, `+`, `=`.
- Seeding is a development tool: never run `db:seed` against production.

## Manual steps

1. Fill the Stripe keys in `iac-journey/ansible/vaults/shobukapp.yml` (`ansible-vault edit`): production reads `shobukapp_vault_stripe_test_secret_key`, `_test_webhook_secret`, `_live_secret_key`, `_live_webhook_secret`; dev reads `shobukapp_vault_stripe_dev_secret_key` and `_dev_webhook_secret`. Declare the webhook endpoints in Stripe: production URL once in test mode and once in live mode, dev URL in test mode (events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`).
2. Add `traefik_vault_shobukapp_dev_basic_auth` (an htpasswd line) to `vaults/traefik.yml`, run `--tags traefik`.
3. Create the OVH bucket `shobukapp` for backups.
4. Create the Jenkins multibranch job `apps/shobukapp` like OdyssAI's, and the GitHub secrets `JENKINS_USER` and `JENKINS_API_TOKEN` on the repository.
5. First deploy: `ansible-playbook ansible/site.yml --tags shobukapp`, then bootstrap the first admin (below).

### First admin

Signup is invitation-only and no admin exists yet to issue one. The admin scripts are compiled into the api image and read `DATABASE_URL` from the container's env file, so they run on the server, inside the running container:

```bash
ssh <host>
docker exec shobukapp-api node dist/src/scripts/admin-invite.js <email> <first name> <last name>
# prints an activation code: create the account on https://shobukapp.joachimjasmin.com/activation, then
docker exec shobukapp-api node dist/src/scripts/admin-grant.js <email>
```

## Production to dev

`make db-prod-to-dev` (reads `.env.local`) replaces the dev database with an **anonymized** copy of production:

1. restores a `pg_dump` of production into a side database `shobukapp_import` on the dev server, server to server (rows never transit the workstation);
2. brings that copy to dev's schema with dev's migrate image (production may be behind, and the anonymization targets dev's schema);
3. runs `scripts/db/anonymize.sql` on it, in one transaction: non-admins become `Membre n` / `membre-n@anonyme.invalid`, admins `Admin n` with their email kept; every personal field is cleared; **every account gets the password `shobukan-demo`** (production hashes never reach dev); join requests, messages, reminder notes, document titles and licence numbers are blanked, admins' documents dropped; sessions and pending invitations deleted (they would work on dev); Stripe ids cleared and the mode forced to test;
4. stops `api-dev`, refuses new connections (a tunnelled Prisma pool would reconnect and block the rename), swaps the databases by rename;
5. starts `api-dev` and waits for it to be healthy, then drops the previous dev database.

On any failure a trap drops the side database (real data until step 3), renames the previous dev database back if the swap was interrupted, and restarts `api-dev`. Real data never sits in the database the dev API serves. Files (photos, certificates, licences) are not copied: downloads answer 404 on dev.
