/*
  Warnings:

  - You are about to drop the `Fragment` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `extendedDescription` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Fragment" DROP CONSTRAINT "Fragment_messageId_fkey";

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "extendedDescription" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Fragment";

-- CreateTable
CREATE TABLE "public"."File" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
