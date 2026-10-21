
-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('FEDERATION', 'MISC');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ChargeMethod" AS ENUM ('STRIPE', 'MANUAL');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "entrance_fee_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "entrance_fee_due_at" TIMESTAMP(3),
ADD COLUMN     "stripe_price_id" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ProductKind" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "member_purchasable" BOOLEAN NOT NULL DEFAULT false,
    "per_season" BOOLEAN NOT NULL DEFAULT false,
    "stripe_test_product_id" TEXT,
    "stripe_test_price_id" TEXT,
    "stripe_live_product_id" TEXT,
    "stripe_live_price_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "method" "ChargeMethod",
    "season" TEXT,
    "note" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "stripe_payment_link_id" TEXT,
    "stripe_payment_link_url" TEXT,
    "stripe_checkout_session_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_stripe_test_product_id_key" ON "products"("stripe_test_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_stripe_test_price_id_key" ON "products"("stripe_test_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_stripe_live_product_id_key" ON "products"("stripe_live_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_stripe_live_price_id_key" ON "products"("stripe_live_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "charges_stripe_payment_link_id_key" ON "charges"("stripe_payment_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "charges_stripe_checkout_session_id_key" ON "charges"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "charges_user_id_status_idx" ON "charges"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

