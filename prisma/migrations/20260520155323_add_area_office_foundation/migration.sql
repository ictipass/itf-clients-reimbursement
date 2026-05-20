-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'AREA_MANAGER';
ALTER TYPE "Role" ADD VALUE 'HORIC';
ALTER TYPE "Role" ADD VALUE 'REVENUE_ACCOUNTANT';
ALTER TYPE "Role" ADD VALUE 'HEAD_OF_TRAINING';
ALTER TYPE "Role" ADD VALUE 'REIMBURSEMENT_OFFICER';
ALTER TYPE "Role" ADD VALUE 'DIRECTOR_FSD';
ALTER TYPE "Role" ADD VALUE 'HEAD_OF_DIVISION';
ALTER TYPE "Role" ADD VALUE 'HQ_REIMBURSEMENT_OFFICER';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "areaOfficeId" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "areaOfficeId" TEXT;

-- CreateTable
CREATE TABLE "AreaOffice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaOffice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaOffice_workspaceId_isActive_idx" ON "AreaOffice"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AreaOffice_workspaceId_slug_key" ON "AreaOffice"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Company_areaOfficeId_status_recordTier_idx" ON "Company"("areaOfficeId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "Membership_areaOfficeId_role_idx" ON "Membership"("areaOfficeId", "role");

-- AddForeignKey
ALTER TABLE "AreaOffice" ADD CONSTRAINT "AreaOffice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_areaOfficeId_fkey" FOREIGN KEY ("areaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_areaOfficeId_fkey" FOREIGN KEY ("areaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
