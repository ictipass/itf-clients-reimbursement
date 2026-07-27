-- CreateEnum
CREATE TYPE "RevenueWorkflowMode" AS ENUM (
  'EXTERNAL_VERIFICATION',
  'IN_APP_REVENUE'
);

-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "revenueWorkflowMode" "RevenueWorkflowMode" NOT NULL DEFAULT 'EXTERNAL_VERIFICATION';
