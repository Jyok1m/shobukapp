-- Stripe ids created so far come from test keys: dev and local only ever had
-- one, and production refused a test key at boot and never received a live
-- one, so it has no Stripe ids at all. Renamed to the test columns, not
-- dropped. Check before deploying elsewhere: a database holding live ids
-- would need them moved to the live columns and livemode set.
ALTER TABLE "plans" RENAME COLUMN "stripe_product_id" TO "stripe_test_product_id";
ALTER TABLE "plans" RENAME COLUMN "stripe_price_id" TO "stripe_test_price_id";
ALTER INDEX "plans_stripe_product_id_key" RENAME TO "plans_stripe_test_product_id_key";
ALTER INDEX "plans_stripe_price_id_key" RENAME TO "plans_stripe_test_price_id_key";
ALTER TABLE "plans" ADD COLUMN "stripe_live_product_id" TEXT,
ADD COLUMN "stripe_live_price_id" TEXT;
CREATE UNIQUE INDEX "plans_stripe_live_product_id_key" ON "plans"("stripe_live_product_id");
CREATE UNIQUE INDEX "plans_stripe_live_price_id_key" ON "plans"("stripe_live_price_id");

ALTER TABLE "users" RENAME COLUMN "stripe_customer_id" TO "stripe_test_customer_id";
ALTER INDEX "users_stripe_customer_id_key" RENAME TO "users_stripe_test_customer_id_key";
ALTER TABLE "users" ADD COLUMN "stripe_live_customer_id" TEXT,
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "terms_accepted_at" DROP NOT NULL;
CREATE UNIQUE INDEX "users_stripe_live_customer_id_key" ON "users"("stripe_live_customer_id");

ALTER TABLE "subscriptions" ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "role_changes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "changed_by_id" UUID,
    "from_role" "Role" NOT NULL,
    "to_role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "role_changes_user_id_idx" ON "role_changes"("user_id");
ALTER TABLE "role_changes" ADD CONSTRAINT "role_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_changes" ADD CONSTRAINT "role_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One row, enforced by the database rather than by the service. Seeded here:
-- the API reads it on every billing call and must always find it.
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "stripe_live" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "app_settings_single_row" CHECK ("id" = 1)
);
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "app_settings" ("id", "stripe_live", "updated_at") VALUES (1, false, CURRENT_TIMESTAMP);
