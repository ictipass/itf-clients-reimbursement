CREATE TYPE "ReimbursementComputationSource" AS ENUM ('HQ_REVIEW', 'AUDIT_RECONCILIATION');

ALTER TABLE "ReimbursementAuditReview"
  ADD COLUMN "reconciliationTableId" TEXT,
  ADD COLUMN "reconciliationAuditSnapshotId" TEXT,
  ADD COLUMN "reconciliationNote" TEXT,
  ADD COLUMN "reconciledById" TEXT,
  ADD COLUMN "reconciledAt" TIMESTAMP(3);

ALTER TABLE "ReimbursementComputationTable"
  ADD COLUMN "source" "ReimbursementComputationSource" NOT NULL DEFAULT 'HQ_REVIEW';

DROP INDEX "ReimbursementComputationTable_reimbursementClaimId_status_r_idx";
CREATE INDEX "ReimbursementComputationTable_claim_source_status_idx"
  ON "ReimbursementComputationTable"("reimbursementClaimId", "source", "status", "recordTier");
