-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "public"."EmbeddingProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmbeddingFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmbeddingExample" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "codeChunk" TEXT,
    "vector" vector(3072),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingExample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmbeddingFile_projectId_idx" ON "public"."EmbeddingFile"("projectId");

-- CreateIndex
CREATE INDEX "EmbeddingExample_projectId_idx" ON "public"."EmbeddingExample"("projectId");

-- CreateIndex
CREATE INDEX "EmbeddingExample_fileId_idx" ON "public"."EmbeddingExample"("fileId");

-- AddForeignKey
ALTER TABLE "public"."EmbeddingFile" ADD CONSTRAINT "EmbeddingFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."EmbeddingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmbeddingExample" ADD CONSTRAINT "EmbeddingExample_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."EmbeddingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmbeddingExample" ADD CONSTRAINT "EmbeddingExample_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."EmbeddingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;