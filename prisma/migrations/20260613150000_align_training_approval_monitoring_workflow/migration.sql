CREATE TYPE "TrainingMonitoringDesk" AS ENUM ('REIMBURSEMENT_OFFICER', 'HEAD_OF_TRAINING', 'AREA_MANAGER', 'COMPANY');
CREATE TYPE "TrainingDecisionOutcome" AS ENUM ('ACCEPTED', 'REJECTED');

ALTER TYPE "WorkItemKind" ADD VALUE 'TRAINING_REQUEST_REVIEW';
ALTER TYPE "WorkItemKind" ADD VALUE 'TRAINING_FEEDBACK';

ALTER TABLE "TrainingRequest"
ADD COLUMN "decisionOutcome" "TrainingDecisionOutcome",
ADD COLUMN "decisionReason" TEXT,
ADD COLUMN "feedbackReleasedAt" TIMESTAMP(3);

ALTER TABLE "TrainingMonitoringRecord"
ADD COLUMN "currentDesk" "TrainingMonitoringDesk" NOT NULL DEFAULT 'REIMBURSEMENT_OFFICER',
ADD COLUMN "decisionOutcome" "TrainingDecisionOutcome",
ADD COLUMN "decisionReason" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "feedbackReleasedAt" TIMESTAMP(3);

ALTER TABLE "Decision"
ADD COLUMN "trainingMonitoringRecordId" TEXT;

CREATE INDEX "TrainingMonitoringRecord_currentDesk_status_recordTier_idx"
ON "TrainingMonitoringRecord"("currentDesk", "status", "recordTier");

CREATE INDEX "Decision_trainingMonitoringRecordId_recordTier_createdAt_idx"
ON "Decision"("trainingMonitoringRecordId", "recordTier", "createdAt");

ALTER TABLE "Decision"
ADD CONSTRAINT "Decision_trainingMonitoringRecordId_fkey"
FOREIGN KEY ("trainingMonitoringRecordId") REFERENCES "TrainingMonitoringRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "TrainingRequest"
SET
  "decisionOutcome" = 'ACCEPTED',
  "feedbackReleasedAt" = COALESCE("approvedAt", "updatedAt")
WHERE "status" = 'APPROVED';

UPDATE "TrainingMonitoringRecord"
SET
  "currentDesk" = 'COMPANY',
  "decisionOutcome" = 'ACCEPTED',
  "decidedAt" = "updatedAt",
  "feedbackReleasedAt" = "updatedAt"
WHERE "status" = 'APPROVED';

UPDATE "TrainingMonitoringRecord"
SET "currentDesk" = 'HEAD_OF_TRAINING'
WHERE "status" = 'SUBMITTED';

UPDATE "TrainingMonitoringRecord"
SET
  "currentDesk" = 'REIMBURSEMENT_OFFICER',
  "status" = 'CHANGES_REQUESTED'
WHERE "status" = 'IN_REVIEW';

INSERT INTO "TrainingMonitoringRecord" (
  "id",
  "trainingRequestId",
  "mode",
  "monitoringDate",
  "startsAt",
  "endsAt",
  "status",
  "currentDesk",
  "recordTier",
  "createdAt",
  "updatedAt"
)
SELECT
  'monitoring-' || md5(tr."id"),
  tr."id",
  CASE
    WHEN lower(COALESCE(tr."trainingType", '')) LIKE '%virtual%'
      THEN 'LOCAL_VIRTUAL'::"TrainingMonitoringMode"
    ELSE 'LOCAL_PHYSICAL'::"TrainingMonitoringMode"
  END,
  tr."startsAt",
  tr."startsAt",
  tr."endsAt",
  'DRAFT',
  'REIMBURSEMENT_OFFICER',
  'HOT',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "TrainingRequest" tr
WHERE tr."status" = 'APPROVED'
  AND tr."recordTier" = 'HOT'
  AND NOT EXISTS (
    SELECT 1
    FROM "TrainingMonitoringRecord" tmr
    WHERE tmr."trainingRequestId" = tr."id"
      AND tmr."recordTier" = 'HOT'
  );
