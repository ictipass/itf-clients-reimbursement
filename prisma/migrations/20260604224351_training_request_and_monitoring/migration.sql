/*
  Warnings:

  - The values [TRAINING_MONITORING_REVIEW] on the enum `WorkItemKind` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `trainingMonitoringRecordId` on the `WorkItem` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WorkItemKind_new" AS ENUM ('REGISTRATION_AREA_MANAGER_REVIEW', 'REGISTRATION_AREA_OFFICE_REVIEW', 'REGISTRATION_RECEIPT_REVIEW', 'REGISTRATION_HQ_NOTIFICATION', 'COMPLIANCE_AWARENESS', 'COMPLIANCE_REVIEW', 'TRAINING_PLAN_REVIEW');
ALTER TABLE "WorkItem" ALTER COLUMN "kind" TYPE "WorkItemKind_new" USING ("kind"::text::"WorkItemKind_new");
ALTER TYPE "WorkItemKind" RENAME TO "WorkItemKind_old";
ALTER TYPE "WorkItemKind_new" RENAME TO "WorkItemKind";
DROP TYPE "public"."WorkItemKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "WorkItem" DROP CONSTRAINT "WorkItem_trainingMonitoringRecordId_fkey";

-- DropIndex
DROP INDEX "WorkItem_trainingMonitoringRecordId_status_recordTier_idx";

-- AlterTable
ALTER TABLE "WorkItem" DROP COLUMN "trainingMonitoringRecordId";

-- RenameIndex
ALTER INDEX "Document_trainingMonitoringRecordId_kind_recordTier_isActive_id" RENAME TO "Document_trainingMonitoringRecordId_kind_recordTier_isActiv_idx";

-- RenameIndex
ALTER INDEX "TrainingMonitoringRecord_trainingRequestId_status_recordTier_id" RENAME TO "TrainingMonitoringRecord_trainingRequestId_status_recordTie_idx";
