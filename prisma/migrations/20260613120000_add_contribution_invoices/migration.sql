CREATE TYPE "ContributionInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'CANCELLED', 'EXPIRED');

ALTER TYPE "DocumentKind" ADD VALUE 'CONTRIBUTION_INVOICE';

CREATE TABLE "ContributionInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "registrationApplicationId" TEXT NOT NULL,
    "contributionAssessmentId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ContributionInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "generatedDocumentId" TEXT,
    "generatedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContributionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionInvoice_registrationApplicationId_key"
ON "ContributionInvoice"("registrationApplicationId");

CREATE UNIQUE INDEX "ContributionInvoice_contributionAssessmentId_key"
ON "ContributionInvoice"("contributionAssessmentId");

CREATE UNIQUE INDEX "ContributionInvoice_invoiceNumber_key"
ON "ContributionInvoice"("invoiceNumber");

CREATE INDEX "ContributionInvoice_companyId_status_recordTier_idx"
ON "ContributionInvoice"("companyId", "status", "recordTier");

CREATE INDEX "ContributionInvoice_issuedById_recordTier_idx"
ON "ContributionInvoice"("issuedById", "recordTier");

ALTER TABLE "ContributionInvoice"
ADD CONSTRAINT "ContributionInvoice_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionInvoice"
ADD CONSTRAINT "ContributionInvoice_registrationApplicationId_fkey"
FOREIGN KEY ("registrationApplicationId") REFERENCES "RegistrationApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionInvoice"
ADD CONSTRAINT "ContributionInvoice_contributionAssessmentId_fkey"
FOREIGN KEY ("contributionAssessmentId") REFERENCES "RegistrationContributionAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionInvoice"
ADD CONSTRAINT "ContributionInvoice_issuedById_fkey"
FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
