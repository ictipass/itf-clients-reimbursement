-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "registrationApplicationId" TEXT;

-- CreateIndex
CREATE INDEX "Document_registrationApplicationId_kind_recordTier_isActive_idx" ON "Document"("registrationApplicationId", "kind", "recordTier", "isActive");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_registrationApplicationId_fkey" FOREIGN KEY ("registrationApplicationId") REFERENCES "RegistrationApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
