ALTER TYPE "DocumentKind" ADD VALUE IF NOT EXISTS 'CERTIFICATE_TEMPLATE_DESIGN';

CREATE INDEX "CertificateTemplate_designDocumentId_idx" ON "CertificateTemplate"("designDocumentId");

ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_designDocumentId_fkey" FOREIGN KEY ("designDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
