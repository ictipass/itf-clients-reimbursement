CREATE TYPE "ReimbursementComputationTableStatus" AS ENUM (
  'DRAFT',
  'PREPARED',
  'CONFIRMED'
);

CREATE TABLE "ReimbursementComputationTable" (
  "id" TEXT NOT NULL,
  "reimbursementClaimId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "itfEmployerNumber" TEXT,
  "claimYear" INTEGER,
  "contributionPaid" DECIMAL(14, 2) NOT NULL,
  "receiptNumber" TEXT,
  "fiftyPercentOfContribution" DECIMAL(14, 2) NOT NULL,
  "areaOfficeName" TEXT,
  "amountRecommended" DECIMAL(14, 2) NOT NULL,
  "amountRecommendedInWords" TEXT,
  "recommendedContributionPercent" DECIMAL(5, 2),
  "preparedById" TEXT,
  "preparedByName" TEXT,
  "preparedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "confirmedByName" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "status" "ReimbursementComputationTableStatus" NOT NULL DEFAULT 'DRAFT',
  "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReimbursementComputationTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReimbursementComputationTableRow" (
  "id" TEXT NOT NULL,
  "computationTableId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "emphasis" INTEGER,
  "areaOfTraining" TEXT NOT NULL,
  "totalEmployees" INTEGER,
  "numberTrained" INTEGER,
  "percentTrained" DECIMAL(5, 2),
  "maxPercentClaimable" DECIMAL(5, 2),
  "percentTrainingContributionAwarded" DECIMAL(5, 2),
  "equivalentAmountOfContribution" DECIMAL(14, 2),
  "expenditureClaimed" DECIMAL(14, 2),
  "amountAwardedLowerOfContributionOrClaim" DECIMAL(14, 2),
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReimbursementComputationTableRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReimbursementComputationTable_reimbursementClaimId_status_recordTier_idx"
  ON "ReimbursementComputationTable"("reimbursementClaimId", "status", "recordTier");
CREATE INDEX "ReimbursementComputationTable_preparedById_recordTier_idx"
  ON "ReimbursementComputationTable"("preparedById", "recordTier");
CREATE INDEX "ReimbursementComputationTable_confirmedById_recordTier_idx"
  ON "ReimbursementComputationTable"("confirmedById", "recordTier");
CREATE INDEX "ReimbursementComputationTableRow_computationTableId_sortOrder_idx"
  ON "ReimbursementComputationTableRow"("computationTableId", "sortOrder");

ALTER TABLE "ReimbursementComputationTable"
  ADD CONSTRAINT "ReimbursementComputationTable_reimbursementClaimId_fkey"
  FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReimbursementComputationTableRow"
  ADD CONSTRAINT "ReimbursementComputationTableRow_computationTableId_fkey"
  FOREIGN KEY ("computationTableId") REFERENCES "ReimbursementComputationTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
