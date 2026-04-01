/*
  Warnings:

  - Made the column `content` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Message" ALTER COLUMN "content" SET NOT NULL,
ALTER COLUMN "extendedDescription" DROP NOT NULL;
