# Deployment

One OVH server, managed in `iac-journey` (Ansible role `shobukapp`), same pattern as OdyssAI. Two copies of the stack in `/opt/shobukapp`: production from `main`, staging from `dev`.

| | Production | Staging |
|---|---|---|
| Site | https://shobukapp.joachimjasmin.com | https://shobukapp-dev.joachimjasmin.com (basic auth) |
| Images | `jyok1m/shobukapp-{api,web,migrate}:main` | `:dev` |
| Postgres | `shobukapp-db`, loopback `5433` | `shobukapp-db-dev`, loopback `15433` |
| `APP_ENV` | `production` (live Stripe key only) | `staging` (test Stripe key only) |
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

1. Fill the Stripe keys in `iac-journey/ansible/vaults/shobukapp.yml` (`ansible-vault edit`), and declare the two webhook endpoints in Stripe (events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`).
2. Add `traefik_vault_shobukapp_dev_basic_auth` (an htpasswd line) to `vaults/traefik.yml`, run `--tags traefik`.
3. Create the OVH bucket `shobukapp` for backups.
4. Create the Jenkins multibranch job `apps/shobukapp` like OdyssAI's, and the GitHub secrets `JENKINS_USER` and `JENKINS_API_TOKEN` on the repository.
5. First deploy: `ansible-playbook ansible/site.yml --tags shobukapp`, then bootstrap the first admin (below).

### First admin

Signup is invitation-only and no admin exists yet to issue one. From a workstation, open the SSH tunnel to the production database (loopback `5433`, credentials in the vault), then:

```bash
DATABASE_URL="postgresql://shobukapp:<password>@localhost:5433/shobukapp?schema=public" \
  pnpm --filter @shobukapp/api admin:invite <email> <first name> <last name>
# prints an activation code: create the account on /activation, then
DATABASE_URL=... pnpm --filter @shobukapp/api admin:grant <email>
```
