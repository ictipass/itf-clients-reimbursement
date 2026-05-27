-- AlterEnum
ALTER TYPE "ManagedNumberType" ADD VALUE 'COMPLIANCE_CERTIFICATE_NUMBER';

-- AlterTable
ALTER TABLE "ManagedRegistrationNumber" ADD COLUMN     "assignedComplianceCertificateId" TEXT;

-- CreateTable
CREATE TABLE "ComplianceCertificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "complianceYearId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "itfEmployerNumber" TEXT NOT NULL,
    "templateId" TEXT,
    "generatedDocumentId" TEXT,
    "generatedAt" TIMESTAMP(3),
    "status" "RegistrationCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCertificate_complianceYearId_key" ON "ComplianceCertificate"("complianceYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceCertificate_certificateNumber_key" ON "ComplianceCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "ComplianceCertificate_companyId_status_recordTier_idx" ON "ComplianceCertificate"("companyId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "ComplianceCertificate_issuedById_recordTier_idx" ON "ComplianceCertificate"("issuedById", "recordTier");

-- CreateIndex
CREATE INDEX "ComplianceCertificate_templateId_status_recordTier_idx" ON "ComplianceCertificate"("templateId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "ComplianceCertificate_itfEmployerNumber_idx" ON "ComplianceCertificate"("itfEmployerNumber");

-- CreateIndex
CREATE INDEX "ManagedRegistrationNumber_assignedComplianceCertificateId_idx" ON "ManagedRegistrationNumber"("assignedComplianceCertificateId");

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_assignedComplianceCertificateId_fkey" FOREIGN KEY ("assignedComplianceCertificateId") REFERENCES "ComplianceCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCertificate" ADD CONSTRAINT "ComplianceCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCertificate" ADD CONSTRAINT "ComplianceCertificate_complianceYearId_fkey" FOREIGN KEY ("complianceYearId") REFERENCES "ComplianceYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCertificate" ADD CONSTRAINT "ComplianceCertificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCertificate" ADD CONSTRAINT "ComplianceCertificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
