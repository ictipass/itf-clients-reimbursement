-- CreateEnum
CREATE TYPE "RegistrationApplicationKind" AS ENUM ('NEW_EMPLOYER', 'LEGACY_EMPLOYER');

-- AlterTable
ALTER TABLE "RegistrationApplication"
ADD COLUMN "registrationKind" "RegistrationApplicationKind" NOT NULL DEFAULT 'NEW_EMPLOYER',
ADD COLUMN "claimedItfEmployerNumber" TEXT;

-- CreateIndex
CREATE INDEX "RegistrationApplication_registrationKind_status_recordTier_idx" ON "RegistrationApplication"("registrationKind", "status", "recordTier");
