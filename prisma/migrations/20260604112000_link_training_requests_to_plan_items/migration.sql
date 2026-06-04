-- AlterTable
ALTER TABLE "TrainingRequest" ADD COLUMN "trainingPlanLineItemId" TEXT;

-- CreateIndex
CREATE INDEX "TrainingRequest_trainingPlanLineItemId_idx" ON "TrainingRequest"("trainingPlanLineItemId");

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_trainingPlanLineItemId_fkey" FOREIGN KEY ("trainingPlanLineItemId") REFERENCES "TrainingPlanLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
