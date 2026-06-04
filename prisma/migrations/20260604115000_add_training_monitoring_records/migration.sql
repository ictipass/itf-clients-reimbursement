-- CreateEnum
CREATE TYPE "TrainingMonitoringMode" AS ENUM ('LOCAL_PHYSICAL', 'LOCAL_VIRTUAL');

-- CreateTable
CREATE TABLE "TrainingMonitoringRecord" (
    "id" TEXT NOT NULL,
    "trainingRequestId" TEXT NOT NULL,
    "mode" "TrainingMonitoringMode" NOT NULL,
    "monitoringDate" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "meetingId" TEXT,
    "passcode" TEXT,
    "virtualLink" TEXT,
    "monitoringOfficerName" TEXT,
    "monitoringOfficerTitle" TEXT,
    "headOfDivisionName" TEXT,
    "directorName" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingMonitoringRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingMonitoringRecord_trainingRequestId_status_recordTier_idx" ON "TrainingMonitoringRecord"("trainingRequestId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "TrainingMonitoringRecord_mode_status_recordTier_idx" ON "TrainingMonitoringRecord"("mode", "status", "recordTier");

-- AddForeignKey
ALTER TABLE "TrainingMonitoringRecord" ADD CONSTRAINT "TrainingMonitoringRecord_trainingRequestId_fkey" FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
