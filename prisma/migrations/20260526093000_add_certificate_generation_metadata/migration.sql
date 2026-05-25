ALTER TABLE "CertificateTemplate" ADD COLUMN "placementMetadata" JSONB;
ALTER TABLE "RegistrationCertificate" ADD COLUMN "generatedAt" TIMESTAMP(3);
