# Plans, subscriptions and payments

Stripe holds prices, cards, invoices and retries. The database holds a mirror good enough to list, filter and decide access.

## Plans (admin CRUD)

- A plan row maps to one Stripe product and one active Stripe price.
- Create: Stripe product, then Stripe price, then the row. Stripe first: an orphan product is harmless and visible in the Stripe dashboard, a row pointing to a nonexistent price breaks a payment. Calls carry an idempotency key.
- **A Stripe price is immutable.** Changing the amount or interval creates a new price, points the plan to it and deactivates the old one. Current subscribers keep the old price until they change plan: Stripe does not migrate existing subscriptions.
- Changing name or description updates the product.
- Delete is an archive: the product and price are deactivated, the row gets `active = false`. A plan someone still pays cannot disappear.
- No euro amount hardcoded anywhere: amounts come from the plan rows.
- A plan created without Stripe (no key, or the seed) has no Stripe ids. Saving it once from the dashboard (even an empty PATCH) creates the product and price.
- **Pitfall:** DTO instances carry every declared field as `undefined` when absent (`useDefineForClassFields`, target ES2023). Spreading one over the current plan erased `interval` and created a one-time price instead of a recurring one. `PlansService.update` filters undefined fields first; do the same anywhere a DTO is merged into an existing object.

## Buying and managing

- `GET /billing/plans` is public: the plans page shows before signup.
- `POST /billing/checkout { planId }` refuses with `already_subscribed` if a subscription is live or late, checked in our table **and at Stripe** (our table only fills on webhook: two tabs could otherwise open two subscriptions). Then it creates a Checkout Session in `subscription` mode for the user's Stripe customer (created on first need, id stored on `users`). Returns the URL, the browser redirects.
- `POST /billing/portal` returns a Customer Portal URL: card, invoices, cancellation. No card form on our side, which keeps us out of PCI scope.
- Success and cancel URLs are built server-side from `WEB_URL`, never received from the browser (open redirect).

## Webhook

`POST /billing/webhook`, public, raw body (`NestFactory.create(AppModule, { rawBody: true })`): the signature is computed on the received bytes.

- Idempotence: an event already in `stripe_events` is answered 200 without processing. See below for when it is written.
- `checkout.session.completed`, `customer.subscription.created|updated|deleted`: upsert `subscriptions` from the Stripe object (re-fetched, not trusted from the event payload, since order is not guaranteed).
- `invoice.paid`: insert into `payments` as `PAID`.
- `invoice.payment_failed`: insert as `FAILED`, never over a `PAID` row (a late failure notice must not undo a payment). It cuts nothing: `past_due` still counts as a member (`MEMBER_STATUSES`), Stripe retries, and `customer.subscription.deleted` is what ends access.
- Subscriptions are matched to a plan by **Stripe product**, not price: after an amount change, existing subscribers keep the old price, which is no longer the plan's `stripe_price_id`. An unknown product is logged and the subscription is stored without a plan, never guessed.
- `stripe_events` gets the event id **after** processing: if a handler fails, Stripe retries and the event is processed again (handlers are upserts, so a replay is harmless).

## Which subscription describes a member

`pickCurrent()`: a member status first (active, trialing, past_due), else late, else the most recently **created**. Never by `updated_at`: a replayed event on an old canceled subscription bumps it and would hide the live one.

## Admin view of payments

`GET /admin/payments` and the practitioner detail list subscription status, last paid invoice and failed invoices. Filters: `status=past_due|unpaid|none`.

## Payment reminders ("Relancer")

- `POST /admin/members/:id/reminders { note? }` sends a French email to the practitioner with a link to `/abonnement`, and writes a `payment_reminders` row (author, date, note).
- Without `SMTP_URL`, the email is logged instead of sent and the row is still written: the demo works without a mail provider.
- Stripe's own dunning emails (Settings, Billing, Subscriptions and emails) complement this; enable them in the Stripe dashboard rather than reimplementing retries.

## Errors

A `StripeError` is caught by `StripeErrorFilter`: logged, answered as 502 `{ code: 'stripe_error' }`. Stripe messages describe our integration, not what the user did, and must not reach the browser.

## Environments

- `APP_ENV` decides the allowed Stripe mode: a `sk_live_` key outside `production` and a `sk_test_` key inside it stop the boot.
- Without `STRIPE_SECRET_KEY`, billing routes answer 503 `billing_disabled` and the plans page hides purchase buttons. The rest of the app works.
- In production, a key without `STRIPE_WEBHOOK_SECRET` stops the boot: we would sell subscriptions nothing records. In development it only disables the webhook route (503), since the secret comes from `stripe listen` once the API runs.
