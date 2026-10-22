-- CreateEnum
CREATE TYPE "LicenseRequestStatus" AS ENUM ('PENDING', 'SENT', 'DONE');

-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('MEMBERS', 'LICENSE_REQUESTS');

-- AlterTable
ALTER TABLE "member_exports" ADD COLUMN     "kind" "ExportKind" NOT NULL DEFAULT 'MEMBERS';

-- CreateTable
CREATE TABLE "license_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "season" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "status" "LicenseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requested_by_id" UUID,
    "sent_at" TIMESTAMP(3),
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "license_requests_status_season_idx" ON "license_requests"("status", "season");

-- CreateIndex
CREATE UNIQUE INDEX "license_requests_user_id_season_discipline_key" ON "license_requests"("user_id", "season", "discipline");

-- AddForeignKey
ALTER TABLE "license_requests" ADD CONSTRAINT "license_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_requests" ADD CONSTRAINT "license_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

