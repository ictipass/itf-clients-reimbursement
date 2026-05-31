-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentKind" ADD VALUE 'TRAINING_PLAN_DOCUMENT';
ALTER TYPE "DocumentKind" ADD VALUE 'LD_PERSONNEL_CV';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "trainingPlanSubmissionId" TEXT;

-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "trainingPlanSubmissionId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "trainingPlanSubmissionId" TEXT;

-- CreateTable
CREATE TABLE "TrainingPlanSubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "ldPersonnelName" TEXT,
    "ldPersonnelPosition" TEXT,
    "ldPersonnelEmail" TEXT,
    "ldPersonnelPhone" TEXT,
    "trainingPlanSummary" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "promptSubmissionScore" DECIMAL(5,2),
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlanSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingPlanSubmission_companyId_status_recordTier_idx" ON "TrainingPlanSubmission"("companyId", "status", "recordTier");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanSubmission_companyId_year_key" ON "TrainingPlanSubmission"("companyId", "year");

-- CreateIndex
CREATE INDEX "Decision_trainingPlanSubmissionId_recordTier_createdAt_idx" ON "Decision"("trainingPlanSubmissionId", "recordTier", "createdAt");

-- CreateIndex
CREATE INDEX "Document_trainingPlanSubmissionId_kind_recordTier_isActive_idx" ON "Document"("trainingPlanSubmissionId", "kind", "recordTier", "isActive");

-- AddForeignKey
ALTER TABLE "TrainingPlanSubmission" ADD CONSTRAINT "TrainingPlanSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_trainingPlanSubmissionId_fkey" FOREIGN KEY ("trainingPlanSubmissionId") REFERENCES "TrainingPlanSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_trainingPlanSubmissionId_fkey" FOREIGN KEY ("trainingPlanSubmissionId") REFERENCES "TrainingPlanSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_trainingPlanSubmissionId_fkey" FOREIGN KEY ("trainingPlanSubmissionId") REFERENCES "TrainingPlanSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
