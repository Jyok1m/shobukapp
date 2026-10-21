# Architecture

```
browser --> apps/web (Next 16, :3000) --rewrite /api/*--> apps/api (Nest 11, :3001) --> Postgres
                                                              |
                                                              |--> Stripe API (plans, Checkout, Portal)
                                                              |--< Stripe webhooks (/billing/webhook)
                                                              |--> file storage (local disk, then S3 compatible)
                                                              `--> SMTP (reminders, optional for the MVP)
```

## Web to API

- `apps/web/next.config.ts` rewrites `/api/:path*` to `${API_URL}/:path*`. The browser only ever sees port 3000: the session cookie is first-party and there is no CORS configuration to keep in sync.
- Server components read the session by forwarding the incoming `cookie` header to the API (`GET /auth/me`). They never decode anything themselves.
- The Stripe webhook is the one route Stripe calls directly on the API, not through the rewrite: it needs the raw body.

## API modules

One Nest module per area, each owning its controller, service and DTOs:

| Module | Routes prefix | Doc |
|---|---|---|
| `PrismaModule` (global) | none | `database.md` |
| `AuthModule` | `/auth` | `auth.md` |
| `UsersModule` | `/me`, `/members`, `/admin/members` | `members.md` |
| `BillingModule` | `/billing`, `/admin/plans`, `/admin/payments` | `billing.md` |
| `DocumentsModule` | `/documents`, `/admin/documents` | `documents.md` |
| `LicensesModule` | `/licenses`, `/admin/licenses` | `documents.md` |
| `MessagesModule` | `/messages` | `messaging.md` |
| `StorageModule` | none (service only) | `documents.md` |
| `MailModule` | none (service only) | `billing.md` |

Admin routes live under `/admin/*` and carry `@Roles('ADMIN')` at the controller level, so a new method cannot forget it.

## Web routes

```
app/
  (public)/            page.tsx (landing + plans), connexion/, inscription/
  (app)/               layout.tsx checks the session, redirects to /connexion
    tableau-de-bord/   member home: membership status, next steps
    profil/
    abonnement/
    annuaire/
    messagerie/
    documents/
    licences/
  (admin)/admin/       layout.tsx checks role ADMIN (convenience only)
    pratiquants/
    formules/
    membres/
    documents/
```

Route segments are French because they are user-facing URLs; component and file names inside stay English.

## Configuration

`apps/api/.env` (see `.env.example`): `PORT`, `APP_ENV`, `DATABASE_URL`, `WEB_URL`, `SESSION_TTL_DAYS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STORAGE_DIR`, `SMTP_URL`, `MAIL_FROM`.
`apps/web/.env.local`: `API_URL`.

Configuration is read through `@nestjs/config` and validated at startup: a missing `DATABASE_URL` stops the boot, a missing Stripe key disables billing instead of crashing, so the rest of the app can be developed without a Stripe account.

## Pitfall

The api and web scaffolds came with their own `pnpm-workspace.yaml` and `pnpm-lock.yaml`. pnpm resolves the nearest workspace file upward from the current directory, so a `pnpm add` run inside `apps/api` would treat it as its own workspace and write a second lockfile. Only the root ones must exist.
