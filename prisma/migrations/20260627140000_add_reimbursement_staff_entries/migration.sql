CREATE TYPE "ReimbursementStaffTrainingArea" AS ENUM (
  'MANAGEMENT',
  'SUPERVISORY',
  'OCCUPATIONAL'
);

CREATE TABLE "ReimbursementClaimStaffEntry" (
  "id" TEXT NOT NULL,
  "reimbursementClaimId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "normalizedEmployeeId" TEXT NOT NULL,
  "employeeName" TEXT,
  "trainingArea" "ReimbursementStaffTrainingArea" NOT NULL,
  "duplicateGroupKey" TEXT,
  "duplicateDetectedAt" TIMESTAMP(3),
  "duplicateResolvedAt" TIMESTAMP(3),
  "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReimbursementClaimStaffEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReimbursementClaimStaffEntry_reimbursementClaimId_trainingArea_recordTier_idx"
  ON "ReimbursementClaimStaffEntry"("reimbursementClaimId", "trainingArea", "recordTier");
CREATE INDEX "ReimbursementClaimStaffEntry_reimbursementClaimId_normalizedEmployeeId_recordTier_idx"
  ON "ReimbursementClaimStaffEntry"("reimbursementClaimId", "normalizedEmployeeId", "recordTier");
CREATE INDEX "ReimbursementClaimStaffEntry_duplicateGroupKey_recordTier_idx"
  ON "ReimbursementClaimStaffEntry"("duplicateGroupKey", "recordTier");

ALTER TABLE "ReimbursementClaimStaffEntry"
  ADD CONSTRAINT "ReimbursementClaimStaffEntry_reimbursementClaimId_fkey"
  FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
