-- CreateEnum
CREATE TYPE "ReimbursementPolicyEdition" AS ENUM ('EIGHTH_REVISED');

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "activeReimbursementEdition" "ReimbursementPolicyEdition" NOT NULL DEFAULT 'EIGHTH_REVISED';

-- AlterTable
ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "policyEdition" "ReimbursementPolicyEdition" NOT NULL DEFAULT 'EIGHTH_REVISED';

-- CreateIndex
CREATE INDEX "ReimbursementClaim_policyEdition_status_recordTier_idx"
  ON "ReimbursementClaim"("policyEdition", "status", "recordTier");
