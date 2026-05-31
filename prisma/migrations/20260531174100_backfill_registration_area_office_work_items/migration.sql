-- Backfill Area Office desk work items for registrations already routed past
-- the first Area Manager desk before desk routing started creating queue items.
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
  'wi-reg-' || lower(ra."currentDesk"::text) || '-' || ra."id",
  o."workspaceId",
  c."organizationId",
  ra."areaOfficeId",
  c."id",
  ra."id",
  ra."currentDesk"::text::"Role",
  'REIMBURSEMENT',
  'REGISTRATION_AREA_OFFICE_REVIEW',
  'OPEN',
  'NORMAL',
  CASE
    WHEN ra."currentDesk" = 'HORIC' THEN 'Review employer registration'
    WHEN ra."currentDesk" = 'REVENUE_ACCOUNTANT' THEN 'Assess registration contribution'
    ELSE 'Continue employer registration review'
  END,
  c."legalName" || ' is awaiting ' || replace(ra."currentDesk"::text, '_', ' ') || ' action.',
  '/registry/' || c."id",
  'registration:' || ra."id" || ':' || lower(ra."currentDesk"::text),
  'HOT',
  COALESCE(ra."submittedAt", ra."createdAt"),
  NOW()
FROM "RegistrationApplication" ra
JOIN "Company" c ON c."id" = ra."companyId"
JOIN "Organization" o ON o."id" = c."organizationId"
WHERE ra."status" = 'SUBMITTED'
  AND ra."currentDesk" IN ('HORIC', 'REVENUE_ACCOUNTANT')
  AND ra."recordTier" = 'HOT'
  AND c."recordTier" = 'HOT'
  AND c."isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "WorkItem" wi
    WHERE wi."sourceKey" = 'registration:' || ra."id" || ':' || lower(ra."currentDesk"::text)
  );
