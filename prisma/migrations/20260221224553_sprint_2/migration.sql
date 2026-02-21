-- CreateEnum
CREATE TYPE "ClubType" AS ENUM ('ACADEMIC', 'ARTS', 'BUSINESS', 'CAREER', 'CULTURAL', 'GAMING', 'MEDIA', 'SPORTS', 'SOCIAL', 'TECHNOLOGY', 'COMMUNITY_SERVICE', 'ENVIRONMENTAL', 'HEALTH_WELLNESS', 'RELIGIOUS', 'BEGINNER_FRIENDLY', 'COMPETITIVE', 'NETWORKING');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PostAudience" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'BOARD_ONLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MembershipAction" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'REVOKED');

-- AlterEnum
ALTER TYPE "ClubRole" ADD VALUE 'BOARD';

-- DropIndex
DROP INDEX "memberships_club_id_idx";

-- DropIndex
DROP INDEX "posts_club_id_created_at_idx";

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "types" "ClubType"[];

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "custom_title" TEXT,
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "audience" "PostAudience" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "membership_audit_logs" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "MembershipAction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membership_audit_logs_membership_id_created_at_idx" ON "membership_audit_logs"("membership_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "memberships_club_id_status_idx" ON "memberships"("club_id", "status");

-- CreateIndex
CREATE INDEX "posts_club_id_status_audience_created_at_idx" ON "posts"("club_id", "status", "audience", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
