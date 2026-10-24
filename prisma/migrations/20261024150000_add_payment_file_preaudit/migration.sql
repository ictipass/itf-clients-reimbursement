CREATE TABLE "ReimbursementPaymentFileAudit" (
    "id" TEXT NOT NULL,
    "reimbursementClaimId" TEXT NOT NULL,
    "status" "ReimbursementAuditReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "voucherChecked" BOOLEAN NOT NULL DEFAULT false,
    "budgetChecked" BOOLEAN NOT NULL DEFAULT false,
    "bankDetailsChecked" BOOLEAN NOT NULL DEFAULT false,
    "amountChecked" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReimbursementPaymentFileAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReimbursementPaymentFileAudit_reimbursementClaimId_key" ON "ReimbursementPaymentFileAudit"("reimbursementClaimId");
CREATE INDEX "ReimbursementPaymentFileAudit_status_recordTier_idx" ON "ReimbursementPaymentFileAudit"("status", "recordTier");
ALTER TABLE "ReimbursementPaymentFileAudit" ADD CONSTRAINT "ReimbursementPaymentFileAudit_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReimbursementPaymentFileAudit" ADD CONSTRAINT "ReimbursementPaymentFileAudit_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReimbursementPaymentFileAudit" ADD CONSTRAINT "ReimbursementPaymentFileAudit_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
