-- AlterEnum
ALTER TYPE "WorkItemKind" ADD VALUE 'TRAINING_MONITORING_REVIEW';

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN "trainingMonitoringRecordId" TEXT;

-- CreateIndex
CREATE INDEX "WorkItem_trainingMonitoringRecordId_status_recordTier_idx" ON "WorkItem"("trainingMonitoringRecordId", "status", "recordTier");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_trainingMonitoringRecordId_fkey" FOREIGN KEY ("trainingMonitoringRecordId") REFERENCES "TrainingMonitoringRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
