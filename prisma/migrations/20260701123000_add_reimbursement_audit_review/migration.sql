-- CreateEnum
CREATE TYPE "ReimbursementAuditReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'VERIFIED', 'CLEARED');

-- CreateTable
CREATE TABLE "ReimbursementAuditReview" (
    "id" TEXT NOT NULL,
    "reimbursementClaimId" TEXT NOT NULL,
    "status" "ReimbursementAuditReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "observations" TEXT,
    "recommendation" TEXT,
    "auditedAmount" DECIMAL(14,2),
    "varianceAmount" DECIMAL(14,2),
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementAuditReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementAuditReview_reimbursementClaimId_key" ON "ReimbursementAuditReview"("reimbursementClaimId");

-- CreateIndex
CREATE INDEX "ReimbursementAuditReview_status_recordTier_idx" ON "ReimbursementAuditReview"("status", "recordTier");

-- CreateIndex
CREATE INDEX "ReimbursementAuditReview_preparedById_recordTier_idx" ON "ReimbursementAuditReview"("preparedById", "recordTier");

-- CreateIndex
CREATE INDEX "ReimbursementAuditReview_verifiedById_recordTier_idx" ON "ReimbursementAuditReview"("verifiedById", "recordTier");

-- AddForeignKey
ALTER TABLE "ReimbursementAuditReview" ADD CONSTRAINT "ReimbursementAuditReview_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementAuditReview" ADD CONSTRAINT "ReimbursementAuditReview_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementAuditReview" ADD CONSTRAINT "ReimbursementAuditReview_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
