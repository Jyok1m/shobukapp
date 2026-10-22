-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('KENDO', 'IAIDO', 'JODO', 'BATTODO');

-- Existing licences predate the discipline: they are backfilled as kendo.
ALTER TABLE "licenses" ADD COLUMN "discipline" "Discipline" NOT NULL DEFAULT 'KENDO';
ALTER TABLE "licenses" ALTER COLUMN "discipline" DROP DEFAULT;

-- DropIndex
DROP INDEX "licenses_user_id_season_key";

-- CreateIndex
CREATE UNIQUE INDEX "licenses_user_id_season_discipline_key" ON "licenses"("user_id", "season", "discipline");
