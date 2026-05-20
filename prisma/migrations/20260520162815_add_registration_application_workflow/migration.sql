-- CreateEnum
CREATE TYPE "RegistrationDesk" AS ENUM ('COMPANY', 'AREA_MANAGER', 'HORIC', 'REVENUE_ACCOUNTANT');

-- CreateTable
CREATE TABLE "RegistrationApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "areaOfficeId" TEXT NOT NULL,
    "submittedById" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "currentDesk" "RegistrationDesk" NOT NULL DEFAULT 'COMPANY',
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationApplication_companyId_key" ON "RegistrationApplication"("companyId");

-- CreateIndex
CREATE INDEX "RegistrationApplication_areaOfficeId_currentDesk_status_rec_idx" ON "RegistrationApplication"("areaOfficeId", "currentDesk", "status", "recordTier");

-- CreateIndex
CREATE INDEX "RegistrationApplication_submittedById_recordTier_idx" ON "RegistrationApplication"("submittedById", "recordTier");

-- AddForeignKey
ALTER TABLE "RegistrationApplication" ADD CONSTRAINT "RegistrationApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationApplication" ADD CONSTRAINT "RegistrationApplication_areaOfficeId_fkey" FOREIGN KEY ("areaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationApplication" ADD CONSTRAINT "RegistrationApplication_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
