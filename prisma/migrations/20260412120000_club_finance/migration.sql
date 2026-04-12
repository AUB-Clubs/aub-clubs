-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "ClubFinance" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "FinanceType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubFinance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubFinance_clubId_createdAt_idx" ON "ClubFinance"("clubId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClubFinance" ADD CONSTRAINT "ClubFinance_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
