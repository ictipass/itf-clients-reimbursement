-- AlterEnum
ALTER TYPE "DecisionAction" ADD VALUE 'FORWARD';

-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "registrationApplicationId" TEXT;

-- CreateIndex
CREATE INDEX "Decision_registrationApplicationId_recordTier_createdAt_idx" ON "Decision"("registrationApplicationId", "recordTier", "createdAt");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_registrationApplicationId_fkey" FOREIGN KEY ("registrationApplicationId") REFERENCES "RegistrationApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
