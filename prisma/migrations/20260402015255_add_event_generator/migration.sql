-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

/*
  Warnings:

  - You are about to drop the `Fragment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Fragment" DROP CONSTRAINT "Fragment_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_clubId_fkey";

-- DropTable
DROP TABLE "Fragment";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "Project";

-- DropEnum
DROP TYPE "MessageType";

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_chunks" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fragments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fragments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_details" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "scale" TEXT,
    "type" TEXT,
    "topic" TEXT,
    "selected_idea" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reports" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_speakers" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "session_focus" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sponsors" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "specific_contribution" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_buildings" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_emails" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_posts" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_images" (
    "id" TEXT NOT NULL,
    "fragment_id" TEXT NOT NULL,
    "supabase_url" TEXT NOT NULL,
    "prompt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_documents" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(1536),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "building_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_documents" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(1536),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_documents" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector(1536),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaker_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_awaiting_event_scale" BOOLEAN NOT NULL DEFAULT false,
    "is_awaiting_event_type" BOOLEAN NOT NULL DEFAULT false,
    "is_awaiting_event_topic" BOOLEAN NOT NULL DEFAULT false,
    "is_awaiting_idea_selection" BOOLEAN NOT NULL DEFAULT false,
    "is_awaiting_event_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_awaiting_email_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_project_id_created_at_idx" ON "messages"("project_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "message_chunks_message_id_sequence_idx" ON "message_chunks"("message_id", "sequence" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fragments_message_id_key" ON "fragments"("message_id");

-- CreateIndex
CREATE INDEX "fragments_message_id_idx" ON "fragments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_details_fragment_id_key" ON "event_details"("fragment_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_reports_fragment_id_key" ON "event_reports"("fragment_id");

-- CreateIndex
CREATE INDEX "event_speakers_fragment_id_idx" ON "event_speakers"("fragment_id");

-- CreateIndex
CREATE INDEX "event_sponsors_fragment_id_idx" ON "event_sponsors"("fragment_id");

-- CreateIndex
CREATE INDEX "event_buildings_fragment_id_idx" ON "event_buildings"("fragment_id");

-- CreateIndex
CREATE INDEX "event_emails_fragment_id_idx" ON "event_emails"("fragment_id");

-- CreateIndex
CREATE INDEX "event_posts_fragment_id_platform_idx" ON "event_posts"("fragment_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "event_images_fragment_id_key" ON "event_images"("fragment_id");

-- CreateIndex
CREATE INDEX "building_documents_created_at_idx" ON "building_documents"("created_at" DESC);

-- CreateIndex
CREATE INDEX "sponsor_documents_created_at_idx" ON "sponsor_documents"("created_at" DESC);

-- CreateIndex
CREATE INDEX "speaker_documents_created_at_idx" ON "speaker_documents"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_chunks" ADD CONSTRAINT "message_chunks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reports" ADD CONSTRAINT "event_reports_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sponsors" ADD CONSTRAINT "event_sponsors_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_buildings" ADD CONSTRAINT "event_buildings_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_emails" ADD CONSTRAINT "event_emails_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "fragments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
