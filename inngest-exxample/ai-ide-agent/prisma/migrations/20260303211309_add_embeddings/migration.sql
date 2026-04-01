-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "public"."GoPluginDoc" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(3072),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoPluginDoc_pkey" PRIMARY KEY ("id")
);