/*
  Warnings:

  - Changed the type of `created` on the `AIScript` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."AIScript" DROP COLUMN "created",
ADD COLUMN     "created" INTEGER NOT NULL;
