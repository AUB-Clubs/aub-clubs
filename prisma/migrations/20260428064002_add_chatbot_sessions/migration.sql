-- CreateEnum
CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateTable
CREATE TABLE "chatbot_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "ChatbotMessageRole" NOT NULL,
    "content" TEXT,
    "tool_calls" JSONB,
    "tool_call_id" TEXT,
    "tool_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatbot_sessions_user_id_updated_at_idx" ON "chatbot_sessions"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "chatbot_messages_session_id_created_at_idx" ON "chatbot_messages"("session_id", "created_at" ASC);

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chatbot_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
