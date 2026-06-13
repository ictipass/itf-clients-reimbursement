CREATE TYPE "PaymentProvider" AS ENUM ('REMITA');
CREATE TYPE "ContributionPaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED');

CREATE TABLE "ContributionPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'REMITA',
    "orderId" TEXT NOT NULL,
    "providerReference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ContributionPaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "statusCode" TEXT,
    "statusMessage" TEXT,
    "paymentUrl" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContributionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionPayment_orderId_key" ON "ContributionPayment"("orderId");
CREATE UNIQUE INDEX "ContributionPayment_providerReference_key" ON "ContributionPayment"("providerReference");
CREATE UNIQUE INDEX "ContributionPayment_invoiceId_provider_key" ON "ContributionPayment"("invoiceId", "provider");
CREATE INDEX "ContributionPayment_companyId_status_recordTier_idx" ON "ContributionPayment"("companyId", "status", "recordTier");
CREATE INDEX "ContributionPayment_provider_status_lastCheckedAt_idx" ON "ContributionPayment"("provider", "status", "lastCheckedAt");
CREATE INDEX "ContributionPayment_initiatedById_recordTier_idx" ON "ContributionPayment"("initiatedById", "recordTier");

ALTER TABLE "ContributionPayment"
ADD CONSTRAINT "ContributionPayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "ContributionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionPayment"
ADD CONSTRAINT "ContributionPayment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionPayment"
ADD CONSTRAINT "ContributionPayment_initiatedById_fkey"
FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
