-- AlterTable
ALTER TABLE "RegistrationContributionAssessment" ADD COLUMN     "amReleaseNote" TEXT,
ADD COLUMN     "amReleasedAt" TIMESTAMP(3),
ADD COLUMN     "amReleasedById" TEXT,
ADD COLUMN     "horicReviewNote" TEXT,
ADD COLUMN     "horicReviewedAt" TIMESTAMP(3),
ADD COLUMN     "horicReviewedById" TEXT;

-- CreateIndex
CREATE INDEX "RegistrationContributionAssessment_horicReviewedById_record_idx" ON "RegistrationContributionAssessment"("horicReviewedById", "recordTier");

-- CreateIndex
CREATE INDEX "RegistrationContributionAssessment_amReleasedById_recordTie_idx" ON "RegistrationContributionAssessment"("amReleasedById", "recordTier");

-- AddForeignKey
ALTER TABLE "RegistrationContributionAssessment" ADD CONSTRAINT "RegistrationContributionAssessment_horicReviewedById_fkey" FOREIGN KEY ("horicReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationContributionAssessment" ADD CONSTRAINT "RegistrationContributionAssessment_amReleasedById_fkey" FOREIGN KEY ("amReleasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
