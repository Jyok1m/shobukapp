-- A cotisation can be paid yearly, quarterly or monthly: the amount and the
-- Stripe price move from the plan to one row per frequency. Existing plans
-- become one price row at their former interval, Stripe ids included, so
-- nothing already sold loses its link.
ALTER TYPE "PlanInterval" ADD VALUE 'QUARTER';

CREATE TABLE "plan_prices" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "frequency" "PlanInterval" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripe_test_price_id" TEXT,
    "stripe_live_price_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

INSERT INTO "plan_prices" ("id", "plan_id", "frequency", "amount_cents", "active",
  "stripe_test_price_id", "stripe_live_price_id", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", "interval", "amount_cents", true,
  "stripe_test_price_id", "stripe_live_price_id", "created_at", CURRENT_TIMESTAMP
FROM "plans";

ALTER TABLE "subscriptions" ADD COLUMN "frequency" "PlanInterval";
UPDATE "subscriptions" s SET "frequency" = p."interval"
FROM "plans" p WHERE s."plan_id" = p."id";

DROP INDEX "plans_stripe_live_price_id_key";
DROP INDEX "plans_stripe_test_price_id_key";
ALTER TABLE "plans" DROP COLUMN "amount_cents",
DROP COLUMN "interval",
DROP COLUMN "stripe_live_price_id",
DROP COLUMN "stripe_test_price_id";

CREATE UNIQUE INDEX "plan_prices_stripe_test_price_id_key" ON "plan_prices"("stripe_test_price_id");
CREATE UNIQUE INDEX "plan_prices_stripe_live_price_id_key" ON "plan_prices"("stripe_live_price_id");
CREATE UNIQUE INDEX "plan_prices_plan_id_frequency_key" ON "plan_prices"("plan_id", "frequency");
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
