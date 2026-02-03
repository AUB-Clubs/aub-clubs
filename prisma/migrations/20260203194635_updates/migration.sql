/*
  Warnings:

  - You are about to drop the column `banner` on the `clubs` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `clubs` table. All the data in the column will be lost.
  - Changed the type of `crn` on the `clubs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updated_at` to the `upvotes` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `aubnet_id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "clubs" DROP COLUMN "banner",
DROP COLUMN "image",
ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "image_url" TEXT,
DROP COLUMN "crn",
ADD COLUMN     "crn" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "upvotes" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "aubnet_id",
ADD COLUMN     "aubnet_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "post_images" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_images_post_id_idx" ON "post_images"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_crn_key" ON "clubs"("crn");

-- CreateIndex
CREATE UNIQUE INDEX "users_aubnet_id_key" ON "users"("aubnet_id");

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
