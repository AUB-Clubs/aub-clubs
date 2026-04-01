/*
  Warnings:

  - You are about to drop the `AIScript` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `File` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AIScript" DROP CONSTRAINT "AIScript_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."File" DROP CONSTRAINT "File_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_projectId_fkey";

-- DropTable
DROP TABLE "public"."AIScript";

-- DropTable
DROP TABLE "public"."File";

-- DropTable
DROP TABLE "public"."Message";

-- DropTable
DROP TABLE "public"."Project";

-- CreateTable
CREATE TABLE "public"."AIIDEMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "extendedDescription" TEXT,
    "role" "public"."MessageRole" NOT NULL,
    "type" "public"."MessageType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "AIIDEMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIIDEFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "AIIDEFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIIDEProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scriptName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIIDEProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIIDEAIScript" (
    "id" TEXT NOT NULL,
    "scriptConfigId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created" BIGINT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "AIIDEAIScript_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AIIDEMessage" ADD CONSTRAINT "AIIDEMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIIDEFile" ADD CONSTRAINT "AIIDEFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIIDEAIScript" ADD CONSTRAINT "AIIDEAIScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
