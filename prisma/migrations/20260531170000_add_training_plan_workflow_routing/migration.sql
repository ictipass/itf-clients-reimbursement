-- CreateEnum
CREATE TYPE "TrainingPlanDesk" AS ENUM ('COMPANY', 'AREA_MANAGER', 'HEAD_OF_TRAINING', 'REIMBURSEMENT_OFFICER');

-- AlterEnum
ALTER TYPE "WorkItemKind" ADD VALUE 'TRAINING_PLAN_REVIEW';

-- AlterTable
ALTER TABLE "TrainingPlanSubmission" ADD COLUMN "currentDesk" "TrainingPlanDesk" NOT NULL DEFAULT 'COMPANY';

-- Backfill existing submitted packages to the first Area Office desk.
UPDATE "TrainingPlanSubmission"
SET "currentDesk" = 'AREA_MANAGER'
WHERE "status" IN ('SUBMITTED', 'IN_REVIEW');

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN "trainingPlanSubmissionId" TEXT;

-- CreateIndex
CREATE INDEX "TrainingPlanSubmission_currentDesk_status_recordTier_idx" ON "TrainingPlanSubmission"("currentDesk", "status", "recordTier");

-- CreateIndex
CREATE INDEX "WorkItem_trainingPlanSubmissionId_status_recordTier_idx" ON "WorkItem"("trainingPlanSubmissionId", "status", "recordTier");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_trainingPlanSubmissionId_fkey" FOREIGN KEY ("trainingPlanSubmissionId") REFERENCES "TrainingPlanSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
