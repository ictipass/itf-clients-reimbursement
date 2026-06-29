-- CreateEnum
CREATE TYPE "ContributionVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ContributionVerificationSource" AS ENUM ('MANUAL', 'EXTERNAL_SYSTEM', 'IN_APP_REVENUE');

-- AlterTable
ALTER TABLE "ReimbursementClaim"
ADD COLUMN "contributionVerificationStatus" "ContributionVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "contributionVerificationSource" "ContributionVerificationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "contributionVerifiedById" TEXT,
ADD COLUMN "contributionVerifiedAt" TIMESTAMP(3),
ADD COLUMN "contributionVerificationNote" TEXT,
ADD COLUMN "externalVerificationProvider" TEXT,
ADD COLUMN "externalVerificationReference" TEXT,
ADD COLUMN "externalVerificationCheckedAt" TIMESTAMP(3),
ADD COLUMN "externalVerificationMessage" TEXT,
ADD COLUMN "externalVerificationPayload" JSONB;

-- CreateIndex
CREATE INDEX "ReimbursementClaim_contributionVerificationStatus_recordTier_idx" ON "ReimbursementClaim"("contributionVerificationStatus", "recordTier");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_extVerificationRef_idx" ON "ReimbursementClaim"("externalVerificationProvider", "externalVerificationReference");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_contributionVerifiedById_recordTier_idx" ON "ReimbursementClaim"("contributionVerifiedById", "recordTier");

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_contributionVerifiedById_fkey" FOREIGN KEY ("contributionVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
