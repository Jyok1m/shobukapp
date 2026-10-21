# Database

PostgreSQL through Prisma. Schema in `apps/api/prisma/schema.prisma`, migrations in `apps/api/prisma/migrations`, client generated into `apps/api/src/generated/prisma` (git-ignored).

## Conventions

- Tables in plural via `@@map("users")`, columns in snake_case via `@map("first_name")`.
- Ids: `String @id @default(uuid()) @db.Uuid`.
- `created_at` and `updated_at` on every table.
- Enums in SCREAMING_CASE, mapped to lowercase only if a hand-written query needs it.
- Never edit an applied migration. A wrong migration is fixed by a new one.
- Deleting a user is a privacy operation, not a cascade by accident: see `privacy.md`.

## Local database until the real URL arrives

```bash
docker run -d --name shobukapp-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shobukapp -p 5432:5432 postgres:17
# apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shobukapp?schema=public"
```

Switching to the real database later only changes `DATABASE_URL`, then `pnpm --filter @shobukapp/api db:deploy`.

## Prisma 7 pitfalls

- The connection URL lives in `apps/api/prisma.config.ts`, not in the `datasource` block, and Prisma no longer loads `.env` by itself: the config file imports `dotenv/config`.
- The client needs a driver adapter (`@prisma/adapter-pg`).
- The api is CommonJS: the `prisma-client` generator sets `moduleFormat = "cjs"`, else the generated files use ESM syntax the Nest build cannot load.
- It also sets `importFileExtension = ""`. With the default `.js` suffix, `tsc` resolves the imports but ts-node (seed, `admin:grant`) and ts-jest do not, and fail with `Cannot find module './internal/class.js'`.
- Prisma 8 is out. Staying on 7 until after the MVP: a major upgrade is its own task.
- `generate` is a turbo task that `build`, `dev` and `typecheck` depend on: a fresh clone has no generated client, and `typecheck` would fail on it.

## Model (MVP draft)

```
users            id, email (unique, lowercased), password_hash, role (PRACTITIONER|ADMIN),
                 first_name, last_name, phone, photo_key,
                 birth_date, sex, nationality, address_line, postal_code, city, country,
                 emergency_contact_name, emergency_contact_phone,
                 directory_visible (default false), stripe_customer_id (unique, nullable)
sessions         id, user_id, token_hash (unique), expires_at, created_at
plans            id, name, description, amount_cents, currency, interval (MONTH|YEAR),
                 stripe_product_id, stripe_price_id, active, sort_order
subscriptions    id, user_id, plan_id, stripe_subscription_id (unique), status,
                 current_period_end, cancel_at_period_end
payments         id, user_id, stripe_invoice_id (unique), amount_cents, status (PAID|FAILED|OPEN), paid_at
stripe_events    id (Stripe event id, primary key = idempotence), type, received_at
payment_reminders id, user_id, sent_by_id, channel (EMAIL), note, created_at
documents        id, owner_id (nullable: null means a dojo document), category
                 (MEDICAL_CERTIFICATE|LEGAL|ACCOUNTING|OTHER), title, storage_key,
                 mime_type, size_bytes, valid_until (nullable), uploaded_by_id
licenses         id, user_id, season ("2026-2027"), number, storage_key, uploaded_by_id,
                 unique (user_id, season)
messages         id, sender_id, recipient_id, body, read_at, created_at
```

`subscriptions.status` mirrors Stripe's values as a string: Stripe adds statuses over time and an enum would reject a webhook the day it does.

## Seed

`pnpm --filter @shobukapp/api db:seed` (idempotent) creates demo data for presentations: two plans (no Stripe ids, they are synced on first admin save), a handful of practitioners with fake names, directory opt-ins and messages. Never real people. Every seeded account uses the password `shobukan-demo`. The admin is not seeded: it is granted with `admin:grant`.
