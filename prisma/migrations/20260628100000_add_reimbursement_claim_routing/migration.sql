-- CreateEnum
CREATE TYPE "ReimbursementClaimDesk" AS ENUM (
  'COMPANY',
  'AREA_MANAGER',
  'HEAD_OF_TRAINING',
  'REIMBURSEMENT_OFFICER',
  'DIRECTOR_FSD',
  'HEAD_OF_DIVISION',
  'HQ_REIMBURSEMENT_OFFICER'
);

-- AlterEnum
ALTER TYPE "WorkItemKind" ADD VALUE IF NOT EXISTS 'REIMBURSEMENT_CLAIM_REVIEW';

-- AlterTable
ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "currentDesk" "ReimbursementClaimDesk" NOT NULL DEFAULT 'COMPANY';

-- AlterTable
ALTER TABLE "WorkItem"
  ADD COLUMN "reimbursementClaimId" TEXT;

-- CreateIndex
CREATE INDEX "ReimbursementClaim_currentDesk_status_recordTier_idx"
  ON "ReimbursementClaim"("currentDesk", "status", "recordTier");

-- CreateIndex
CREATE INDEX "WorkItem_reimbursementClaimId_status_recordTier_idx"
  ON "WorkItem"("reimbursementClaimId", "status", "recordTier");

-- AddForeignKey
ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_reimbursementClaimId_fkey"
  FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
