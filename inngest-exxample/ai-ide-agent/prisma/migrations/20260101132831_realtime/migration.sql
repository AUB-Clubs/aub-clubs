-- CreateTable
CREATE TABLE "public"."AIIDEMessageChunk" (
    "id" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "AIIDEMessageChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIIDEMessageChunk_messageId_idx" ON "public"."AIIDEMessageChunk"("messageId");

-- AddForeignKey
ALTER TABLE "public"."AIIDEMessageChunk" ADD CONSTRAINT "AIIDEMessageChunk_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."AIIDEMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
