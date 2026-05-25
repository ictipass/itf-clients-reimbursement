CREATE TYPE "CertificateTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "CertificateTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "designDocumentId" TEXT,
    "notes" TEXT,
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificateTemplate_workspaceId_code_version_key" ON "CertificateTemplate"("workspaceId", "code", "version");
CREATE INDEX "CertificateTemplate_workspaceId_status_recordTier_effectiveFrom_idx" ON "CertificateTemplate"("workspaceId", "status", "recordTier", "effectiveFrom");
CREATE INDEX "RegistrationCertificate_templateId_status_recordTier_idx" ON "RegistrationCertificate"("templateId", "status", "recordTier");

ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationCertificate" ADD CONSTRAINT "RegistrationCertificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
