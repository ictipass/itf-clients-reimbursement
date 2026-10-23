CREATE TABLE "ReimbursementCalculationSnapshot" (
  "id" TEXT NOT NULL,
  "reimbursementClaimId" TEXT NOT NULL,
  "stage" "ReimbursementClaimLineStage" NOT NULL,
  "policyEdition" "ReimbursementPolicyEdition" NOT NULL,
  "employerScale" "ReimbursementEmployerScale" NOT NULL,
  "calculatedByEmail" TEXT NOT NULL,
  "calculationInput" JSONB NOT NULL,
  "calculationResult" JSONB NOT NULL,
  "uncappedAwardPercent" DECIMAL(5, 2) NOT NULL,
  "cappedAwardPercent" DECIMAL(5, 2) NOT NULL,
  "totalAmountAwarded" DECIMAL(14, 2) NOT NULL,
  "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReimbursementCalculationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReimbursementCalculationSnapshot_reimbursementClaimId_stage_createdAt_idx"
  ON "ReimbursementCalculationSnapshot"("reimbursementClaimId", "stage", "createdAt");

ALTER TABLE "ReimbursementCalculationSnapshot"
  ADD CONSTRAINT "ReimbursementCalculationSnapshot_reimbursementClaimId_fkey"
  FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
