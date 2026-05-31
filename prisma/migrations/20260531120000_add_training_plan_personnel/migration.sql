-- CreateTable
CREATE TABLE "TrainingPlanPersonnel" (
    "id" TEXT NOT NULL,
    "trainingPlanSubmissionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlanPersonnel_pkey" PRIMARY KEY ("id")
);

-- Preserve any existing single-person L&D details from the first draft migration.
INSERT INTO "TrainingPlanPersonnel" (
    "id",
    "trainingPlanSubmissionId",
    "name",
    "position",
    "email",
    "phone",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-' || "id",
    "id",
    "ldPersonnelName",
    "ldPersonnelPosition",
    "ldPersonnelEmail",
    "ldPersonnelPhone",
    "createdAt",
    CURRENT_TIMESTAMP
FROM "TrainingPlanSubmission"
WHERE "ldPersonnelName" IS NOT NULL AND length(trim("ldPersonnelName")) > 0;

-- AlterTable
ALTER TABLE "TrainingPlanSubmission"
DROP COLUMN "ldPersonnelEmail",
DROP COLUMN "ldPersonnelName",
DROP COLUMN "ldPersonnelPhone",
DROP COLUMN "ldPersonnelPosition";

-- CreateIndex
CREATE INDEX "TrainingPlanPersonnel_trainingPlanSubmissionId_idx" ON "TrainingPlanPersonnel"("trainingPlanSubmissionId");

-- AddForeignKey
ALTER TABLE "TrainingPlanPersonnel" ADD CONSTRAINT "TrainingPlanPersonnel_trainingPlanSubmissionId_fkey" FOREIGN KEY ("trainingPlanSubmissionId") REFERENCES "TrainingPlanSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
