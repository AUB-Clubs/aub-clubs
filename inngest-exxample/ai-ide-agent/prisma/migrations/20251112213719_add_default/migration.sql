/*
  Warnings:

  - Made the column `projectType` on table `AIIDEProject` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."AIIDEProject" ALTER COLUMN "projectType" SET NOT NULL,
ALTER COLUMN "projectType" SET DEFAULT 'UNSET';
