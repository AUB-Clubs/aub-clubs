/*
  Warnings:

  - Added the required column `projectType` to the `AIIDEProject` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ProjectType" AS ENUM ('PROVISIONING', 'NORMAL');

-- AlterTable
ALTER TABLE "public"."AIIDEProject" ADD COLUMN     "projectType" "public"."ProjectType" NOT NULL;
