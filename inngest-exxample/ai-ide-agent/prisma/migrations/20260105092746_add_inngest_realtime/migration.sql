-- DropIndex
DROP INDEX "public"."AIIDEMessage_createdAt_idx";

-- DropIndex
DROP INDEX "public"."AIIDEMessage_id_idx";

-- DropIndex
DROP INDEX "public"."AIIDEMessage_type_idx";

-- CreateTable
CREATE TABLE "public"."AIIDEAgentStep" (
    "id" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepStatus" TEXT NOT NULL,
    "stepOutput" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "runId" TEXT NOT NULL,

    CONSTRAINT "AIIDEAgentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIIDEAgentRun" (
    "id" TEXT NOT NULL,
    "runStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "AIIDEAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIIDEAgentStep_runId_idx" ON "public"."AIIDEAgentStep"("runId");

-- CreateIndex
CREATE INDEX "AIIDEAgentRun_projectId_idx" ON "public"."AIIDEAgentRun"("projectId");

-- CreateIndex
CREATE INDEX "AIIDEAIScript_projectId_idx" ON "public"."AIIDEAIScript"("projectId");

-- CreateIndex
CREATE INDEX "AIIDEFile_projectId_idx" ON "public"."AIIDEFile"("projectId");

-- AddForeignKey
ALTER TABLE "public"."AIIDEAgentStep" ADD CONSTRAINT "AIIDEAgentStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."AIIDEAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIIDEAgentRun" ADD CONSTRAINT "AIIDEAgentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."AIIDEProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
