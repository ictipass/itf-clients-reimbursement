ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "paymentAccountType" TEXT,
  ADD COLUMN "paymentWithholdingTax" DECIMAL(14,2),
  ADD COLUMN "paymentTaxOffset" DECIMAL(14,2);
