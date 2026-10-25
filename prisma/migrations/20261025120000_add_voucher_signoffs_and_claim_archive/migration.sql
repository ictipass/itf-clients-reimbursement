CREATE TYPE "ReimbursementVoucherSignoffKind" AS ENUM (
  'PAYMENT_APPROVED', 'PV_PREPARED', 'PV_CHECKED', 'BUDGET_CLEARED',
  'BUDGET_VERIFIED', 'PRE_AUDIT_CLEARED', 'PRE_AUDIT_VERIFIED', 'PAYMENT_RECORDED'
);

ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "voucherSignoffRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archiveSnapshot" JSONB;

CREATE TABLE "ReimbursementVoucherSignoff" (
  "id" TEXT NOT NULL,
  "reimbursementClaimId" TEXT NOT NULL,
  "kind" "ReimbursementVoucherSignoffKind" NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" "Role" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "remark" TEXT,
  "method" TEXT NOT NULL DEFAULT 'AUTHENTICATED_SESSION',
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
  CONSTRAINT "ReimbursementVoucherSignoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReimbursementVoucherSignoff_reimbursementClaimId_kind_key"
  ON "ReimbursementVoucherSignoff"("reimbursementClaimId", "kind");
CREATE INDEX "ReimbursementVoucherSignoff_actorId_signedAt_idx"
  ON "ReimbursementVoucherSignoff"("actorId", "signedAt");
ALTER TABLE "ReimbursementVoucherSignoff"
  ADD CONSTRAINT "ReimbursementVoucherSignoff_reimbursementClaimId_fkey"
  FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReimbursementVoucherSignoff"
  ADD CONSTRAINT "ReimbursementVoucherSignoff_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
