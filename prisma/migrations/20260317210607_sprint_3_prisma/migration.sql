-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('GENERAL', 'IMPORTANT', 'URGENT');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "priority" "AnnouncementPriority" NOT NULL DEFAULT 'GENERAL';
