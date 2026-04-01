/*
  Warnings:

  - You are about to drop the `Script` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Script" DROP CONSTRAINT "Script_projectId_fkey";

-- DropTable
DROP TABLE "public"."Script";

-- CreateTable
CREATE TABLE "public"."AIScript" (
    "id" TEXT NOT NULL,
    "scriptConfigId" TEXT NOT NULL,
    "scriptName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "AIScript_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AIScript" ADD CONSTRAINT "AIScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
