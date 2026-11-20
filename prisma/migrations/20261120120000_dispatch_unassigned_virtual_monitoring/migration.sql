-- Existing virtual monitoring records were created directly in a shared HQ RO queue.
-- Send only still-open, unassigned records to the Head of Reimbursement Division
-- so each can be dispatched to a named HQ RO through the new assignment action.
UPDATE "WorkItem" AS work_item
SET "assignedRole" = 'HEAD_OF_DIVISION',
    "title" = 'Assign virtual training monitoring',
    "emailNotifiedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "TrainingMonitoringRecord" AS record
WHERE work_item."trainingMonitoringRecordId" = record."id"
  AND work_item."app" = 'REIMBURSEMENT'
  AND work_item."recordTier" = 'HOT'
  AND work_item."kind" = 'TRAINING_MONITORING_REVIEW'
  AND work_item."status" = 'OPEN'
  AND work_item."assignedRole" = 'HQ_REIMBURSEMENT_OFFICER'
  AND work_item."assignedUserId" IS NULL
  AND record."mode" = 'LOCAL_VIRTUAL'
  AND record."currentDesk" = 'HQ_REIMBURSEMENT_OFFICER'
  AND record."status" IN ('DRAFT', 'CHANGES_REQUESTED');
