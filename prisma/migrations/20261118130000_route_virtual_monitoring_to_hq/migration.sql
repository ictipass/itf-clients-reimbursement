ALTER TYPE "TrainingMonitoringDesk" ADD VALUE IF NOT EXISTS 'HQ_REIMBURSEMENT_OFFICER';
ALTER TYPE "TrainingMonitoringDesk" ADD VALUE IF NOT EXISTS 'HEAD_OF_DIVISION';
ALTER TYPE "TrainingMonitoringDesk" ADD VALUE IF NOT EXISTS 'DIRECTOR_FSD';

CREATE INDEX "TrainingMonitoringRecord_mode_monitoringDate_recordTier_idx"
ON "TrainingMonitoringRecord"("mode", "monitoringDate", "recordTier");

-- Preserve completed decisions and their audit trail. Move only open virtual records
-- to the equivalent HQ desks so existing pending monitoring work is not stranded.
UPDATE "TrainingMonitoringRecord"
SET "currentDesk" = CASE "currentDesk"::text
  WHEN 'REIMBURSEMENT_OFFICER' THEN 'HQ_REIMBURSEMENT_OFFICER'::"TrainingMonitoringDesk"
  WHEN 'HEAD_OF_TRAINING' THEN 'HEAD_OF_DIVISION'::"TrainingMonitoringDesk"
  WHEN 'AREA_MANAGER' THEN 'DIRECTOR_FSD'::"TrainingMonitoringDesk"
  ELSE "currentDesk" END
WHERE "mode" = 'LOCAL_VIRTUAL'
  AND "status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED');

UPDATE "WorkItem" wi
SET "assignedRole" = CASE wi."assignedRole"::text
  WHEN 'REIMBURSEMENT_OFFICER' THEN 'HQ_REIMBURSEMENT_OFFICER'::"Role"
  WHEN 'HEAD_OF_TRAINING' THEN 'HEAD_OF_DIVISION'::"Role"
  WHEN 'AREA_MANAGER' THEN 'DIRECTOR_FSD'::"Role"
  ELSE wi."assignedRole" END,
  "areaOfficeId" = NULL,
  "sourceKey" = replace(replace(replace(replace(wi."sourceKey", ':reimbursement-officer', ':hq-reimbursement-officer'), ':reimbursement_officer', ':hq_reimbursement_officer'), ':head_of_training', ':head_of_division'), ':area_manager', ':director_fsd')
FROM "TrainingMonitoringRecord" mr
WHERE wi."trainingMonitoringRecordId" = mr.id
  AND wi."status" = 'OPEN'
  AND mr."mode" = 'LOCAL_VIRTUAL'
  AND mr."status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED')
  AND wi."kind" = 'TRAINING_MONITORING_REVIEW';
