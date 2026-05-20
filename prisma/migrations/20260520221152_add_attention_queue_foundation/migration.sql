-- CreateEnum
CREATE TYPE "WorkspaceApp" AS ENUM ('REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "WorkItemKind" AS ENUM ('REGISTRATION_RECEIPT_REVIEW');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "areaOfficeId" TEXT,
    "companyId" TEXT,
    "registrationApplicationId" TEXT,
    "assignedUserId" TEXT,
    "assignedRole" "Role",
    "app" "WorkspaceApp" NOT NULL DEFAULT 'REIMBURSEMENT',
    "kind" "WorkItemKind" NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "targetHref" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_sourceKey_key" ON "WorkItem"("sourceKey");

-- CreateIndex
CREATE INDEX "WorkItem_workspaceId_app_status_recordTier_createdAt_idx" ON "WorkItem"("workspaceId", "app", "status", "recordTier", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItem_areaOfficeId_assignedRole_status_recordTier_idx" ON "WorkItem"("areaOfficeId", "assignedRole", "status", "recordTier");

-- CreateIndex
CREATE INDEX "WorkItem_organizationId_status_recordTier_idx" ON "WorkItem"("organizationId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "WorkItem_assignedUserId_status_recordTier_idx" ON "WorkItem"("assignedUserId", "status", "recordTier");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_areaOfficeId_fkey" FOREIGN KEY ("areaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_registrationApplicationId_fkey" FOREIGN KEY ("registrationApplicationId") REFERENCES "RegistrationApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
