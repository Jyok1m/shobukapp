# Plans, subscriptions and payments

Stripe holds prices, cards, invoices and retries. The database holds a mirror good enough to list, filter and decide access.

## Seasons and the dojo's grid

The grid is versioned in code, one file per season (`apps/api/src/billing/grids/2026-2027.ts`), from the dojo's printed grid: cotisations per number of weekly units (1 unité = 1 discipline once a week), adults 1, 2, 3 units or unlimited, children (up to 14) 1 or 2 units, each yearly, quarterly and monthly. Monthly is the quarterly amount / 3 and the children's yearly amount is quarterly x 4, as on the printed grid (child 1 unit monthly: 48.33 €, one cent under a third of 145 €).

- `pnpm --filter @shobukapp/api grid:import <season> [--archive-others]` (in a container: `docker exec shobukapp-api node dist/src/scripts/import-grid.js <season>`): upserts plans and products **by slug** in the current Stripe mode, like an admin edit would. `--archive-others` archives the active plans missing from the grid. Run it again after switching to live.
- A new season is a new file in `GRIDS`, then an import. Same slugs, new amounts: Stripe gets new prices, the old ones are deactivated.
- **Price changes reach current members at their next renewal.** `PlansService.moveSubscribers` swaps the item of each live subscription on a replaced price to the new one with `proration_behavior: none` (nothing invoiced now, the next invoice uses the new amount), stores `subscriptions.stripe_price_id` and mails the member the old and new amounts with the date. Same path for an amount edited in "Formules". Idempotency key: subscription and new price. A subscription set to cancel at period end is left alone.

## Annual entrance fee

`plans.entrance_fee_cents` (60 € adults, 45 € children; editable per plan). Stripe cannot mix yearly and monthly recurring items in one subscription, so it is not a recurring price:

- At checkout, a one-time line item "Droit d'entrée annuel" is added unless a subscription of the same mode has `entrance_fee_due_at` in the future (paid less than a year ago, then re-subscribed). The next due date (now + 1 year) travels in `subscription_data.metadata.entranceFeeDueAt` and is stored on the first sync.
- Then yearly: on `invoice.created` (`billing_reason = subscription_cycle`, still `draft`), when `entrance_fee_due_at` is reached (one day of slack), the API adds an invoice item to that draft (idempotency key per invoice) and moves the date one year on. Stripe finalizes a subscription invoice about an hour after creating it and waits for the `invoice.created` webhook to succeed, so the item lands in time. **The webhook endpoint must listen to `invoice.created`.**
- A plan without fee sets no due date: a later subscription to a plan with one pays it. A long overdue date moves on until it is in the future.
- Subscriptions created before this feature have no due date and are never charged the yearly fee (only test data existed then).
- `GET /billing/subscription` returns `entranceFeePaidUntil`; `GET /billing/plans` returns `entranceFeeCents`.

## One-off products and charges

`products` (slug, kind `FEDERATION` or `MISC`, amount, `member_purchasable`, `per_season`), one Stripe product and one one-time price per mode. A new amount is a new price, but the old one stays active so links already sent keep working at the amount they announced; the other mode's price is recreated on its next use. `charges` is what a member owes or paid for one product, in one Stripe mode (`livemode`). Payments made off Stripe (paid at the dojo, declined, waived) count in both modes (`chargesOfMode`).

- FFJDA licence and insurance (56 €, per season) and the sports passport (10 €, valid 8 years) are `FEDERATION`: the bureau decides. From a member's admin page, `POST /admin/members/:id/charges {productId, sendLink, note?}` records a pending charge (once per season for a per-season product, one pending passport at a time: `charge_exists`, serialized by an advisory lock per member and product) and, with `sendLink`, creates a **Stripe Payment Link** (card only, one completed payment max, `metadata.chargeId`) mailed to the member; the charge takes the product's current amount at that moment, so mail and link agree. A charge of the other Stripe mode gets no link (`charge_other_mode`). `POST /admin/charges/:id/link` sends it again. `PATCH /admin/charges/:id {status}` records a payment made at the dojo (`PAID`, method `MANUAL`), a refusal (`DECLINED`) or a waiver (`WAIVED`), and deactivates the link (back to `PENDING` reactivates it); a charge paid online cannot be changed here (`charge_paid_online`, refund in Stripe), the write is conditional so a webhook landing meanwhile wins.
- `MISC` products marked `member_purchasable` (private lesson 60 €, drop-in class 25 €) are bought by the member: `GET /billing/products`, `POST /billing/products/:id/checkout` (Checkout in `payment` mode, cards only so the payment is immediate). An abandoned attempt's pending charge is reused by the next one, whose older session is expired.
- `checkout.session.completed` in `payment` mode marks the charge `PAID` (method `STRIPE`), matched by `metadata.chargeId`, else by payment link or session id, always within the event's mode; a replay is a no-op.
- `GET /billing/charges`: the member's own charges, the link only while pending. `GET /admin/members` carries `federation`: this season's licence and the passport status per member. Seasons run September to August (`currentSeason()`, Paris time).

## Frequencies

A cotisation (a plan, "Adulte", "Étudiant") can be paid **yearly, quarterly or monthly**. Each frequency it offers is a row of `plan_prices` with its own amount, chosen freely by the admin (a discount on the yearly one is just a lower amount), and its own Stripe price per mode. The member picks the cotisation, then the frequency, at checkout (`POST /billing/checkout {planId, frequency}`).

- Stripe has no quarterly interval: `QUARTER` is a price with `recurring: {interval: 'month', interval_count: 3}`. `frequencyOf()` reads a Stripe price back into a frequency.
- One Stripe product per plan and mode, one price per frequency under it.
- A plan must offer at least one frequency (`no_frequency_offered`); a frequency appears once per plan (`duplicate_frequency`). `PATCH /admin/plans/:id {prices: [...]}` creates or updates the listed frequencies and leaves the others untouched.
- A frequency whose amount changes gets a new Stripe price, the old one deactivated. Changed while not offered, its price is dropped and recreated when offered again: an old amount must never come back.
- `subscriptions.frequency` is copied from the Stripe price at each sync.

## Changing frequency

`POST /billing/subscription/frequency/preview {frequency}` returns the amount due now; `POST /billing/subscription/frequency {frequency}` applies it. Same cotisation, another of its offered prices; only for an `active` or `trialing` cotisation of the current mode (`no_active_cotisation`, `same_frequency`, `frequency_not_offered`).

- `proration_behavior: always_invoice`: Stripe invoices the difference at once and credits the unused time (monthly 25 € to yearly 240 € costs 215 € today; checked against Stripe test mode). An interval change also restarts the billing period.
- `payment_behavior: pending_if_incomplete`: the change only applies once that invoice is paid. **A declined card does not throw**: Stripe answers 200 with `pending_update` and keeps the old price (checked in test mode with `pm_card_chargeCustomerFail`). The API then voids the open invoice (otherwise paying it later would apply the change by surprise; voiding also clears the pending update) and answers 402 `payment_declined`.
- Idempotency key on the update: subscription, old price, new price and current period start. Two tabs or a retry send one update; going back and forth in a later period is a new request.
- The subscription is re-synced right away; the webhook confirms it.
- When the unused time is worth more than the new price (yearly to quarterly), nothing is due and the rest stays as a credit on the Stripe customer, deducted from the next payments: the preview returns it as `creditCents`.
- Migration `plan_frequencies` turned each existing plan into one price row at its former interval, Stripe ids included.

## Plans (admin CRUD)

- A plan row maps to one Stripe product per mode, and each of its frequencies to one active Stripe price (see Frequencies).
- Create: Stripe product, then Stripe price, then the row. Stripe first: an orphan product is harmless and visible in the Stripe dashboard, a row pointing to a nonexistent price breaks a payment. Calls carry an idempotency key.
- **A Stripe price is immutable.** Changing the amount or interval creates a new price, points the plan to it and deactivates the old one. Stripe does not migrate existing subscriptions by itself: the API moves them at their next renewal (see Seasons).
- Changing name or description updates the product.
- Delete is an archive: the product and price are deactivated, the row gets `active = false`. A plan someone still pays cannot disappear.
- No euro amount hardcoded anywhere: amounts come from the plan rows.
- A plan created without Stripe (no key, or the seed) has no Stripe ids. Saving it once from the dashboard (even an empty PATCH) creates the product and price.
- **Pitfall:** DTO instances carry every declared field as `undefined` when absent (`useDefineForClassFields`, target ES2023). Spreading one over the current plan erased `interval` and created a one-time price instead of a recurring one. `PlansService.update` filters undefined fields first; do the same anywhere a DTO is merged into an existing object.

## Buying and managing

- `GET /billing/plans` is public: the plans page shows before signup.
- `POST /billing/checkout { planId }` refuses with `already_subscribed` if a subscription is live or late, checked in our table **and at Stripe** (our table only fills on webhook: two tabs could otherwise open two subscriptions). Then it creates a Checkout Session in `subscription` mode for the user's Stripe customer (created on first need, id stored on `users`). Returns the URL, the browser redirects.
- `POST /billing/portal` returns a Customer Portal URL, opened with **our own portal configuration** per mode (`metadata.app = shobukapp`, created on first use, idempotent): card, invoices, name, address and phone, cancellation at period end, no plan switching (frequency changes stay in the app). Stripe refuses a portal in a mode where no configuration was ever saved, which a fresh live account is. No card form on our side, which keeps us out of PCI scope. `manageable` (the button) is true once the member has a subscription or a payment in the current mode: a former member still reads their invoices, someone who only abandoned a checkout has nothing to manage.
- Success and cancel URLs are built server-side from `WEB_URL`, never received from the browser (open redirect).

## Webhook

`POST /billing/webhook`, public, raw body (`NestFactory.create(AppModule, { rawBody: true })`): the signature is computed on the received bytes.

- Idempotence: an event already in `stripe_events` is answered 200 without processing. See below for when it is written.
- `checkout.session.completed` in `payment` mode settles a charge (see One-off products).
- `invoice.created`: adds the annual entrance fee to a renewal draft when due.
- `checkout.session.completed` (subscription), `customer.subscription.created|updated|deleted`: upsert `subscriptions` from the Stripe object (re-fetched, not trusted from the event payload, since order is not guaranteed).
- `invoice.paid`: insert into `payments` as `PAID`.
- `invoice.payment_failed`: insert as `FAILED`, never over a `PAID` row (a late failure notice must not undo a payment). It cuts nothing: `past_due` still counts as a member (`MEMBER_STATUSES`), Stripe retries, and `customer.subscription.deleted` is what ends access.
- Subscriptions are matched to a plan by **Stripe product**, not price: after an amount change, existing subscribers keep the old price, which is no longer the plan's `stripe_price_id`. An unknown product is logged and the subscription is stored without a plan, never guessed.
- `stripe_events` gets the event id **after** processing: if a handler fails, Stripe retries and the event is processed again (handlers are upserts, so a replay is harmless).

## Which subscription describes a member

`pickCurrent()`: a member status first (active, trialing, past_due), else late, else the most recently **created**. Never by `updated_at`: a replayed event on an old canceled subscription bumps it and would hide the live one.

## Admin view of payments

`GET /admin/payments` and the practitioner detail list subscription status, last paid invoice and failed invoices. Filters: `status=past_due|unpaid|none`.

## Payment reminders ("Relancer")

- `POST /admin/members/:id/reminders { note? }` sends a French email to the practitioner with a link to `/cotisation`, and writes a `payment_reminders` row (author, date, note).
- Without `SMTP_HOST`, the email is logged instead of sent and the row is still written: the demo works without a mail provider.
- Stripe's own dunning emails (Settings, Billing, Subscriptions and emails) complement this; enable them in the Stripe dashboard rather than reimplementing retries.

## Errors

A `StripeError` is caught by `StripeErrorFilter`: logged, answered as 502 `{ code: 'stripe_error' }`. Stripe messages describe our integration, not what the user did, and must not reach the browser.

## Modes (test and live)

Production carries two Stripe key pairs (`STRIPE_TEST_*`, `STRIPE_LIVE_*`); an admin switches the serving mode in the dashboard (`GET/PUT /admin/settings/billing`, password re-entered). This lets the dojo open signups and demo payments in test mode before the Stripe account is live, then go live without a deploy.

- **Every Stripe object belongs to one mode.** Plans carry `stripe_test_*` and `stripe_live_*` product and price ids, users a customer id per mode, subscriptions and payments a `livemode` flag copied from Stripe. Test and live objects never cross.
- **Only the current mode counts**: membership, payment history, admin lists and the export read the subscriptions and payments of the current mode. After going live, a subscription paid with a test card makes nobody a member.
- **Plan edits reach the current mode only.** Switching runs `syncAllForMode` first: every plan gets its product and price in the target mode as the row describes it now (amount, interval, name, archived), comparing with the live price at Stripe. If Stripe refuses, the mode does not change.
- **One webhook URL for both modes**: declare the endpoint twice in Stripe (once in test, once in live), each with its own secret. The API tries each configured secret and takes the mode from `event.livemode`.
- **Test mode is announced everywhere money is involved**: Stripe Checkout shows a submit message (card 4242 4242 4242 4242, nothing debited, not carried over to live), and `/cotisation` shows the same notice (`testMode`).
- **Switching to live does not carry test cotisations over**, by design: they were paid with a test card. Members holding one get a mail at the switch, and `/cotisation` tells them (`testCotisationNotCarried`). Everything else carries over: accounts, profiles, documents, licences, messages are not tied to a mode, only Stripe objects are.
- A mode without key is unavailable (409 `stripe_mode_unavailable`). Without the current mode's key, billing answers 503 `billing_disabled`.
- Migration `roles_and_stripe_modes` renamed the existing ids to the test columns: everything created so far came from a test key.

## Environments

- A live key outside `APP_ENV=production` stops the boot, as does a live key in the test slot or a test key in the live slot. The legacy `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` pair still works and lands in the slot its prefix names.
- Without the current mode's key, billing routes answer 503 `billing_disabled` and the plans page hides purchase buttons. The rest of the app works.
- In production, a key without its webhook secret stops the boot: we would sell subscriptions nothing records. In development it only disables the webhook (503), since the secret comes from `stripe listen` once the API runs.
