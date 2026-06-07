CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING_SCAN', 'SAFE', 'QUARANTINED', 'REJECTED');

ALTER TABLE "Document"
ADD COLUMN "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'SAFE',
ADD COLUMN "scannedAt" TIMESTAMP(3),
ADD COLUMN "scanReason" TEXT;

ALTER TABLE "Document" ALTER COLUMN "scanStatus" SET DEFAULT 'PENDING_SCAN';

CREATE INDEX "Document_scanStatus_recordTier_isActive_idx"
ON "Document"("scanStatus", "recordTier", "isActive");
