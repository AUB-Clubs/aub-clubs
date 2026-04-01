/*
  Warnings:

  - You are about to drop the column `scriptName` on the `AIScript` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."AIScript" DROP COLUMN "scriptName";

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "scriptName" TEXT;
