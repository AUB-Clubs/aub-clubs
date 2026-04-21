-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "status" "ClubStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
