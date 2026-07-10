-- CreateTable
CREATE TABLE "user_microsoft_calendar_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "ms_user_id" TEXT,
    "account_email" TEXT,
    "encrypted_refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_microsoft_calendar_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_microsoft_calendar_links_user_id_key" ON "user_microsoft_calendar_links"("user_id");

-- AddForeignKey
ALTER TABLE "user_microsoft_calendar_links" ADD CONSTRAINT "user_microsoft_calendar_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
