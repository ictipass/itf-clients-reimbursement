UPDATE "RegistrationApplication"
SET "currentDesk" = 'DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE'
WHERE "currentDesk" = 'DIRECTOR_FSD'
  AND "status" = 'IN_REVIEW';

UPDATE "RegistrationApplication"
SET "currentDesk" = 'HQ_REVENUE_ACCOUNTANT'
WHERE "currentDesk" = 'HEAD_OF_DIVISION'
  AND "status" = 'IN_REVIEW';

UPDATE "WorkItem"
SET "assignedRole" = 'DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE'
WHERE "kind" = 'REGISTRATION_HQ_NOTIFICATION'
  AND "assignedRole" = 'DIRECTOR_FSD'
  AND "status" IN ('OPEN', 'ACKNOWLEDGED');

UPDATE "WorkItem"
SET "assignedRole" = 'HQ_REVENUE_ACCOUNTANT'
WHERE "kind" = 'REGISTRATION_HQ_NOTIFICATION'
  AND "assignedRole" = 'HEAD_OF_DIVISION'
  AND "status" IN ('OPEN', 'ACKNOWLEDGED');

UPDATE "WorkItem"
SET "assignedRole" = 'HEAD_INSPECTORATE_COMPLIANCE'
WHERE "kind" = 'COMPLIANCE_REVIEW'
  AND "assignedRole" = 'HEAD_OF_DIVISION'
  AND "status" IN ('OPEN', 'ACKNOWLEDGED');
