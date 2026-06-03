-- AlterEnum
ALTER TYPE "WorkItemKind" ADD VALUE 'COMPLIANCE_AWARENESS';
ALTER TYPE "WorkItemKind" ADD VALUE 'COMPLIANCE_REVIEW';

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN "complianceYearId" TEXT;

-- CreateIndex
CREATE INDEX "WorkItem_complianceYearId_status_recordTier_idx" ON "WorkItem"("complianceYearId", "status", "recordTier");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_complianceYearId_fkey" FOREIGN KEY ("complianceYearId") REFERENCES "ComplianceYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
