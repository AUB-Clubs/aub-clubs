/*
  Warnings:

  - You are about to drop the column `description` on the `AIIDEAIScript` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."AIIDEAIScript" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "public"."AIIDEProject" ADD COLUMN "isAIProject" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."AIIDEProject" ADD COLUMN "isAwaitingScriptActivation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."AIIDEProject" ADD COLUMN  "scriptDescription" TEXT;
