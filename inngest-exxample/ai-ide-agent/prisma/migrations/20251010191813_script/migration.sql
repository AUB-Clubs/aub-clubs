-- CreateTable
CREATE TABLE "public"."Script" (
    "id" TEXT NOT NULL,
    "scriptConfigId" TEXT NOT NULL,
    "scriptName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Script" ADD CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
