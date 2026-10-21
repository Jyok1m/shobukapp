
-- CreateEnum
CREATE TYPE "DocumentPlacement" AS ENUM ('PRIVATE', 'ANNOUNCEMENT', 'IMPORTANT');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'RULES';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "description" TEXT,
ADD COLUMN     "placement" "DocumentPlacement" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "published_at" TIMESTAMP(3);

