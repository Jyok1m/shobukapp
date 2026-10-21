# MVP plan (presentation tonight)

Goal: a live demo where a practitioner signs up, fills their profile, buys a plan in Stripe test mode, uploads a medical certificate and messages another member; then an admin creates a plan, sees who paid and who did not, sends a reminder and exports the members.

Each step ends with `pnpm typecheck && pnpm lint && pnpm build` (plus API tests when the API changed), a reviewer pass and **one commit**. The order is chosen so the demo is presentable after any step past the cut line.

## Prerequisites (to provide)

- `DATABASE_URL` (a local Docker Postgres meanwhile, see `database.md`).
- Stripe test account: `sk_test_...` key and the Stripe CLI logged in (`stripe login`) for the webhook.
- Optional: SMTP URL. Without it, reminders are logged instead of sent.
- Approval of the dependencies below (one go):
  - api: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`, `argon2`, `cookie-parser`, `class-validator`, `class-transformer`, `@nestjs/throttler`, `stripe`, `@types/multer`, `nodemailer` (+ `@types/nodemailer`, `@types/cookie-parser`)
  - web: none required beyond the scaffold.

## Steps

| # | Step | Owner | Commit |
|---|---|---|---|
| 0 | Repo hygiene: remove nested `pnpm-workspace.yaml` and `pnpm-lock.yaml` in apps, api on port 3001, Next rewrite `/api/*`, `.env.example` files, `allowBuilds` for argon2 and Prisma | main | `chore: ...` |
| 1 | Prisma 7 setup, full MVP schema, first migration, `PrismaService`, seed, `admin:grant` script | back | `feat(api): add prisma schema and initial migration` |
| 2 | Auth: register, login, logout, me, sessions, `SessionGuard` + `RolesGuard`, throttling, e2e tests | back | `feat(api): add email and password auth with sessions` |
| 3 | Web shell: tokens, UI primitives, `/connexion`, `/inscription`, `(app)` layout with nav, `(admin)` layout, `/tableau-de-bord` | front | `feat(web): add auth pages and app shell` |
| 4 | Profile and directory: `/me`, `/members`, photo upload, `/profil`, `/annuaire` | back, front | two commits |
| 5 | Billing: admin plans CRUD synced to Stripe, public plans, Checkout, Portal, webhook, `/abonnement`, `/admin/formules` | back, front | two commits |
| **cut line** | **Everything above is the minimum demo.** | | |
| 6 | Admin members: list with payment status, detail, edit, CSV export, reminders, `/admin/pratiquants`, `/admin/membres` | back, front | two commits |
| 7 | Documents and licences: storage service, member documents, dojo documents, licences, three pages | back, front | two commits |
| 8 | Messaging: conversations, thread, polling, unread badge | back, front | two commits |
| 9 | Demo polish: seed with realistic fake members, empty states, demo script run end to end | main | `chore: ...` |

Steps 4 to 8 split back and front: the back agent ships the routes with tests first, the front agent builds on them right after. Back of step N+1 can run in parallel with front of step N.

## Honest estimate

Steps 0 to 5 are a few hours of focused work and the Stripe webhook is the riskiest part (raw body, CLI forwarding, event order). Steps 6 to 8 are each smaller but add up. If the evening gets short, present up to the cut line plus step 6 (it is the admin story people will ask about), and show 7 and 8 as the next iteration.

## Demo script

1. Admin (pre-granted) opens "Formules", creates "Cotisation annuelle adulte", shows it appeared in the Stripe dashboard.
2. New tab, private window: sign up as a practitioner, fill "Mon profil", opt into the directory.
3. "Mon abonnement": buy the plan with card `4242 4242 4242 4242`, come back, status turns "Actif" once the webhook lands.
4. "Mes documents": upload a medical certificate with its validity date.
5. "Annuaire": see the seeded members, open a conversation, send a message.
6. Back to admin: "Pratiquants" shows the new member as active, a seeded member as "En retard de paiement", click "Relancer".
7. "Membres": export the CSV, open it in Excel.

## Known shortcuts to fix after the demo

- No password reset by email.
- Local disk storage (not suitable for a multi-instance or container deployment).
- Polling for messages.
- No privacy policy, terms or retention job yet (`privacy.md`).
- No CI, no deployment target chosen.
