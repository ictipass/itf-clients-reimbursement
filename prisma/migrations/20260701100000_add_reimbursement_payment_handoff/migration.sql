-- CreateEnum
CREATE TYPE "ReimbursementPaymentHandoffStatus" AS ENUM ('NOT_READY', 'READY_FOR_EXPORT', 'EXPORTED', 'SENT_TO_PAYMENT_SYSTEM', 'PV_RAISED', 'PV_CHECKED', 'AUDIT_CLEARED', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "ReimbursementClaim"
ADD COLUMN "paymentHandoffStatus" "ReimbursementPaymentHandoffStatus" NOT NULL DEFAULT 'NOT_READY',
ADD COLUMN "paymentScheduleReference" TEXT,
ADD COLUMN "paymentScheduleExportedAt" TIMESTAMP(3),
ADD COLUMN "paymentScheduleExportedById" TEXT,
ADD COLUMN "paymentSystemReference" TEXT,
ADD COLUMN "paymentSystemStatus" TEXT,
ADD COLUMN "paymentSystemSyncedAt" TIMESTAMP(3),
ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ReimbursementClaim_paymentHandoffStatus_recordTier_idx" ON "ReimbursementClaim"("paymentHandoffStatus", "recordTier");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_paymentScheduleReference_recordTier_idx" ON "ReimbursementClaim"("paymentScheduleReference", "recordTier");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_paymentScheduleExportedById_recordTier_idx" ON "ReimbursementClaim"("paymentScheduleExportedById", "recordTier");

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_paymentScheduleExportedById_fkey" FOREIGN KEY ("paymentScheduleExportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
