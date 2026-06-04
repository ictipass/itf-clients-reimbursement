-- CreateTable
CREATE TABLE "TrainingPlanLineItem" (
    "id" TEXT NOT NULL,
    "trainingPlanSubmissionId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "gapIdentified" TEXT NOT NULL,
    "trainingTitle" TEXT NOT NULL,
    "estimatedCost" DECIMAL(14,2) NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "location" TEXT NOT NULL,
    "trainer" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlanLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingPlanLineItem_trainingPlanSubmissionId_idx" ON "TrainingPlanLineItem"("trainingPlanSubmissionId");

-- AddForeignKey
ALTER TABLE "TrainingPlanLineItem" ADD CONSTRAINT "TrainingPlanLineItem_trainingPlanSubmissionId_fkey" FOREIGN KEY ("trainingPlanSubmissionId") REFERENCES "TrainingPlanSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
