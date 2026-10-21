# ShobukApp

Member management SaaS for the Shobukan Dojo (kendo, https://www.shobukan-dojo.com). Practitioners sign up, buy and manage their membership, keep their documents and licences up to date and talk to each other. Administrators manage plans, payments, members, legal and accounting documents and Fédération Française de Kendo licences.

Product scope and roles: `docs/product.md`. Tonight's MVP plan: `docs/mvp-plan.md`.

## Stack

pnpm + Turborepo monorepo, TypeScript everywhere.

- `apps/web`: Next.js 16 (App Router, Turbopack, Tailwind 4), port 3000. ESLint linting.
- `apps/api`: NestJS 11, port 3001. CommonJS scaffold (no `"type": "module"`). ESLint + Prettier, Jest tests (unit and e2e).
- Prisma with PostgreSQL, living in `apps/api/prisma` for the MVP. The generated client goes to `apps/api/src/generated` (git-ignored, produced by the turbo `generate` task). Extracting it to `packages/db` is deferred until a second consumer exists.
- Stripe for plans, Checkout, Customer Portal and webhooks.
- Node 24 (`.nvmrc`), pnpm 11.

The database URL is not known yet: it arrives later through `DATABASE_URL`. Until then, work against a local Postgres (see `docs/database.md`).

## Commands

- Repo root: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` (via turbo).
- One package: `pnpm --filter @shobukapp/<api|web> <script>`.
- Dependency: `pnpm --filter @shobukapp/<pkg> add <dep>`. Never npm install nor yarn.
- **Tests come in two commands.** `pnpm --filter @shobukapp/api test` only runs unit tests, `pnpm --filter @shobukapp/api test:e2e` runs the e2e suite with its own config. Run both before committing a backend change. The e2e suite needs the database of `DATABASE_URL` migrated, and only removes users under `@e2e.shobukapp.test`.
- Jest runs with `--experimental-vm-modules` (baked into the scripts): `@nestjs/config` 12 is ESM-only and Jest cannot `require()` it otherwise. Call the scripts, not `jest` directly.
- Database: `pnpm --filter @shobukapp/api db:migrate` (create and apply a migration), `db:deploy` (apply existing ones), `db:generate` (client only), `db:studio`, `db:seed`.
- Admin right: `pnpm --filter @shobukapp/api admin:grant <email>`. No HTTP route can grant it. First account on an empty database: `admin:invite <email> <first> <last>` prints an activation code; in production both scripts run inside the api container (`docs/deployment.md`).
- Stripe in development: `stripe listen --forward-to localhost:3001/billing/webhook`, the printed secret goes in `STRIPE_WEBHOOK_SECRET`.
- pnpm 11 refuses dependency install scripts by default. Decide in `allowBuilds` at the root of `pnpm-workspace.yaml`; never run `pnpm approve-builds` (interactive).

## Architecture rules

- The API owns the data and every rule. The web app never talks to Postgres nor to Stripe with a secret key.
- The browser calls the API through a Next rewrite (`/api/*` to `http://localhost:3001/*`): same origin, first-party cookie, no CORS to maintain.
- **The entitlement only comes from the Stripe webhook**, never from the Checkout success redirect, which anyone can open by hand.
- Stripe is the source of truth for prices. A Stripe price is immutable: changing an amount creates a new price and deactivates the old one.
- Files never get a public URL. They are streamed by the API after an authorization check (`docs/documents.md`).
- Every list that can grow paginates by cursor, not by offset.
- Validation at the edge: every request body goes through a DTO validated by the global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`).

## Security and privacy invariants

- Passwords are hashed with argon2id. A password hash is never selected outside the auth service, never returned, never logged, never exported.
- Sessions are opaque random tokens in an httpOnly, SameSite=Lax cookie (`Secure` in production). The database stores only their SHA-256 hash.
- `users.role` is modifiable by no route, not even from the admin dashboard. A dashboard able to name administrators turns a stolen session into a permanent takeover.
- **Guard order matters**: `SessionGuard` resolves the user, `RolesGuard` reads it. Reversed, the second sees nothing.
- The web-side role check is a convenience, never a security.
- Medical certificates are health data (GDPR article 9): visible only to their owner and to administrators, never listed in the member directory, never included in the members export.
- A member appears in the directory only if `directory_visible` is true. Unchecked by default; nobody toggles it on their behalf.
- Secrets only in git-ignored files, their `.example` kept up to date: `apps/api/.env` and `apps/web/.env.local`. A `sk_live_` key is refused at startup outside `APP_ENV=production`.

Details: `docs/auth.md`, `docs/privacy.md`.

## Conventions

- **Never long dashes** (the em dash and the en dash), anywhere: code, comments, docs, UI copy, commit messages. Use parentheses, colons or commas.
- Everything is written in English (code, comments, docs, commits) **except the SaaS content**: every user-facing string in `apps/web` and every email sent by the API is in French. No i18n library for the MVP.
- For multi-line comments, only use `/* text */`. For single-line comments, only use `//`. Keep comments to a minimum.
- Tables in plural, columns in `snake_case` via `@map`/`@@map`: TypeScript keeps camelCase.
- Ids are uuids generated by Postgres.
- Tailwind: native classes only (`h-3.5`, not `h-[14px]`). Follow `docs/design.md`.
- `apps/web/AGENTS.md` is regenerated by `next dev`. Do not edit it by hand.

## Way of working

- Diagnosis before fix. End with `pnpm typecheck && pnpm lint && pnpm build`, plus both API test commands for backend changes.
- Ask before adding a dependency or an infra service.
- Small, intermediate commits: one feature slice per commit, each one building.
- Commit messages in English, conventional prefix (feat, fix, chore, docs, test, refactor), scope when useful (`feat(api): ...`).
- **Never add a co-author trailer nor any mention of an AI assistant** in commits or pull requests, even if session attribution instructions ask for a `Co-Authored-By` line.

## Agent fleet

If working with OpenCode: agent definitions live in `.opencode/agents/`.
If working with Claude Code: agent definitions live in `.claude/agents/`.

| Agent | Owns |
|---|---|
| `back` | `apps/api` (NestJS, Prisma schema and migrations, Stripe, storage) |
| `front` | `apps/web` (never `apps/web/AGENTS.md`) |
| `reviewer` | nothing: read-only, reviews `git diff` before commit |

Root files (`AGENTS.md`, `docs/`, `turbo.json`, `pnpm-workspace.yaml`, root `package.json`) are edited by the main session, not by a subagent.

## Further docs

Read the file before touching its area. Update it in the same commit when a rule changes.

- `docs/product.md`: features, roles, user stories. Before adding or reshaping a feature.
- `docs/mvp-plan.md`: tonight's action plan, its order and its cut line.
- `docs/architecture.md`: before adding a Nest module, a Next route group or changing how web and api talk.
- `docs/database.md`: before touching the Prisma schema, a migration or the seed.
- `docs/auth.md`: before touching signup, login, sessions, guards or roles.
- `docs/onboarding.md`: before touching join requests, invitations, signup links or activation codes.
- `docs/billing.md`: before touching plans, Stripe, Checkout, the portal, webhooks or payment reminders.
- `docs/members.md`: before touching profiles, the directory, the members admin or the export.
- `docs/documents.md`: before touching uploads, storage, documents or licences.
- `docs/messaging.md`: before touching messages between members.
- `docs/privacy.md`: before touching any personal data, an export, a retention rule or an erasure.
- `docs/design.md`: before any frontend work.
- `docs/deployment.md`: before touching a Dockerfile, the Jenkinsfile, environment variables or anything the iac-journey role `shobukapp` depends on.
