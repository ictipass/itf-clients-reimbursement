-- CreateEnum
CREATE TYPE "AuthenticationSource" AS ENUM ('LOCAL', 'GOOGLE', 'WORKSPACE_SSO');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "authenticationSource" "AuthenticationSource" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "provisionedAt" TIMESTAMP(3),
ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3),
ADD COLUMN "lastSignedInAt" TIMESTAMP(3);
