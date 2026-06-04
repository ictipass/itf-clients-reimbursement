-- AlterTable
ALTER TABLE "Document" ADD COLUMN "trainingMonitoringRecordId" TEXT;

-- CreateTable
CREATE TABLE "TrainingMonitoringEvaluation" (
    "id" TEXT NOT NULL,
    "trainingMonitoringRecordId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "ratingArea" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingMonitoringEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingMonitoringEvaluation_trainingMonitoringRecordId_idx" ON "TrainingMonitoringEvaluation"("trainingMonitoringRecordId");

-- CreateIndex
CREATE INDEX "Document_trainingMonitoringRecordId_kind_recordTier_isActive_idx" ON "Document"("trainingMonitoringRecordId", "kind", "recordTier", "isActive");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_trainingMonitoringRecordId_fkey" FOREIGN KEY ("trainingMonitoringRecordId") REFERENCES "TrainingMonitoringRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMonitoringEvaluation" ADD CONSTRAINT "TrainingMonitoringEvaluation_trainingMonitoringRecordId_fkey" FOREIGN KEY ("trainingMonitoringRecordId") REFERENCES "TrainingMonitoringRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
