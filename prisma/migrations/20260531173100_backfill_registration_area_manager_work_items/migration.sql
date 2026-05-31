-- Backfill Area Manager work items for registrations already submitted before the
-- dashboard queue started creating the initial registration review item.
INSERT INTO "WorkItem" (
  "id",
  "workspaceId",
  "organizationId",
  "areaOfficeId",
  "companyId",
  "registrationApplicationId",
  "assignedRole",
  "app",
  "kind",
  "status",
  "priority",
  "title",
  "summary",
  "targetHref",
  "sourceKey",
  "recordTier",
  "createdAt",
  "updatedAt"
)
SELECT
  'wi-reg-am-' || ra."id",
  o."workspaceId",
  c."organizationId",
  ra."areaOfficeId",
  c."id",
  ra."id",
  'AREA_MANAGER',
  'REIMBURSEMENT',
  'REGISTRATION_AREA_MANAGER_REVIEW',
  'OPEN',
  'NORMAL',
  'Review employer registration',
  c."legalName" || ' submitted Form 7A registration for Area Manager review.',
  '/registry/' || c."id",
  'registration:' || ra."id" || ':area-manager-review',
  'HOT',
  COALESCE(ra."submittedAt", ra."createdAt"),
  NOW()
FROM "RegistrationApplication" ra
JOIN "Company" c ON c."id" = ra."companyId"
JOIN "Organization" o ON o."id" = c."organizationId"
WHERE ra."status" = 'SUBMITTED'
  AND ra."currentDesk" = 'AREA_MANAGER'
  AND ra."recordTier" = 'HOT'
  AND c."recordTier" = 'HOT'
  AND c."isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "WorkItem" wi
    WHERE wi."sourceKey" = 'registration:' || ra."id" || ':area-manager-review'
  );
