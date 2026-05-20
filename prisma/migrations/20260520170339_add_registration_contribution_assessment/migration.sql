-- CreateTable
CREATE TABLE "RegistrationContributionAssessment" (
    "id" TEXT NOT NULL,
    "registrationApplicationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "areaOfficeId" TEXT NOT NULL,
    "assessedById" TEXT NOT NULL,
    "payrollBasis" DECIMAL(14,2),
    "turnoverBasis" DECIMAL(14,2),
    "recommendedAmount" DECIMAL(14,2) NOT NULL,
    "assessmentNote" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationContributionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationContributionAssessment_registrationApplicationI_key" ON "RegistrationContributionAssessment"("registrationApplicationId");

-- CreateIndex
CREATE INDEX "RegistrationContributionAssessment_companyId_recordTier_idx" ON "RegistrationContributionAssessment"("companyId", "recordTier");

-- CreateIndex
CREATE INDEX "RegistrationContributionAssessment_areaOfficeId_recordTier_idx" ON "RegistrationContributionAssessment"("areaOfficeId", "recordTier");

-- CreateIndex
CREATE INDEX "RegistrationContributionAssessment_assessedById_recordTier_idx" ON "RegistrationContributionAssessment"("assessedById", "recordTier");

-- AddForeignKey
ALTER TABLE "RegistrationContributionAssessment" ADD CONSTRAINT "RegistrationContributionAssessment_registrationApplication_fkey" FOREIGN KEY ("registrationApplicationId") REFERENCES "RegistrationApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationContributionAssessment" ADD CONSTRAINT "RegistrationContributionAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationContributionAssessment" ADD CONSTRAINT "RegistrationContributionAssessment_areaOfficeId_fkey" FOREIGN KEY ("areaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationContributionAssessment" ADD CONSTRAINT "RegistrationContributionAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
