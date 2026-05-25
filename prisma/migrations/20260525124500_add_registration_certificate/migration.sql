CREATE TYPE "RegistrationCertificateStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "RegistrationCertificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "registrationApplicationId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "itfEmployerNumber" TEXT NOT NULL,
    "templateId" TEXT,
    "generatedDocumentId" TEXT,
    "status" "RegistrationCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationCertificate_registrationApplicationId_key" ON "RegistrationCertificate"("registrationApplicationId");
CREATE UNIQUE INDEX "RegistrationCertificate_certificateNumber_key" ON "RegistrationCertificate"("certificateNumber");
CREATE INDEX "RegistrationCertificate_companyId_status_recordTier_idx" ON "RegistrationCertificate"("companyId", "status", "recordTier");
CREATE INDEX "RegistrationCertificate_issuedById_recordTier_idx" ON "RegistrationCertificate"("issuedById", "recordTier");
CREATE INDEX "RegistrationCertificate_itfEmployerNumber_idx" ON "RegistrationCertificate"("itfEmployerNumber");

ALTER TABLE "RegistrationCertificate" ADD CONSTRAINT "RegistrationCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationCertificate" ADD CONSTRAINT "RegistrationCertificate_registrationApplicationId_fkey" FOREIGN KEY ("registrationApplicationId") REFERENCES "RegistrationApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationCertificate" ADD CONSTRAINT "RegistrationCertificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
