-- CreateEnum
CREATE TYPE "TrainingRequestDesk" AS ENUM ('COMPANY', 'AREA_MANAGER', 'HEAD_OF_TRAINING', 'REIMBURSEMENT_OFFICER');

-- AlterTable
ALTER TABLE "TrainingRequest" ADD COLUMN "currentDesk" "TrainingRequestDesk" NOT NULL DEFAULT 'COMPANY';

-- CreateIndex
CREATE INDEX "TrainingRequest_currentDesk_status_recordTier_idx" ON "TrainingRequest"("currentDesk", "status", "recordTier");
