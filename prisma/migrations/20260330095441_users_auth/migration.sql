-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "last_name" DROP NOT NULL,
ALTER COLUMN "dob" DROP NOT NULL,
ALTER COLUMN "aubnet_id" DROP NOT NULL;
