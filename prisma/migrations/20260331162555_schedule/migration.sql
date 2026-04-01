-- CreateEnum
CREATE TYPE "ScheduleItemType" AS ENUM ('COURSE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleInferenceStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REJECTED');

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "default_event_color" TEXT DEFAULT '#2563EB';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "color" TEXT DEFAULT '#2563EB',
ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_schedules" ADD COLUMN     "color" TEXT DEFAULT '#1D4ED8',
ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" "ScheduleItemType" NOT NULL DEFAULT 'COURSE';

-- CreateTable
CREATE TABLE "schedule_inference_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_mime_type" TEXT NOT NULL,
    "source_base64" TEXT NOT NULL,
    "extracted_json" JSONB,
    "status" "ScheduleInferenceStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_inference_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_overlap_cache" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "full_overlap_percentage" DOUBLE PRECISION NOT NULL,
    "partial_overlap_percentage" DOUBLE PRECISION NOT NULL,
    "no_overlap_percentage" DOUBLE PRECISION NOT NULL,
    "total_members" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_overlap_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_inference_jobs_user_id_created_at_idx" ON "schedule_inference_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "event_overlap_cache_event_id_key" ON "event_overlap_cache"("event_id");

-- CreateIndex
CREATE INDEX "event_overlap_cache_expires_at_idx" ON "event_overlap_cache"("expires_at");

-- AddForeignKey
ALTER TABLE "schedule_inference_jobs" ADD CONSTRAINT "schedule_inference_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_overlap_cache" ADD CONSTRAINT "event_overlap_cache_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
