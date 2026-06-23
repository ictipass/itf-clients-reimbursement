INSERT INTO "WorkItem" (
  "id",
  "workspaceId",
  "organizationId",
  "areaOfficeId",
  "companyId",
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
  'jurisdiction-attention-' || request."id",
  organization."workspaceId",
  company."organizationId",
  COALESCE(request."fromAreaOfficeId", request."toAreaOfficeId"),
  request."companyId",
  'AREA_MANAGER'::"Role",
  'REIMBURSEMENT'::"WorkspaceApp",
  'JURISDICTION_CHANGE_REVIEW'::"WorkItemKind",
  'OPEN'::"WorkItemStatus",
  'NORMAL'::"WorkItemPriority",
  'Review jurisdiction change request',
  company."legalName" || ' requested a change of Area Office jurisdiction.',
  '/jurisdiction-requests',
  'jurisdiction-change:' || request."id" || ':area-manager',
  'HOT'::"RecordTier",
  request."requestedAt",
  NOW()
FROM "JurisdictionChangeRequest" request
JOIN "Company" company ON company."id" = request."companyId"
JOIN "Organization" organization ON organization."id" = company."organizationId"
WHERE request."status" = 'PENDING'
ON CONFLICT ("sourceKey") DO NOTHING;
