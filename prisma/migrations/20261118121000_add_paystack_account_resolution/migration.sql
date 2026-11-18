ALTER TABLE "BankDirectoryEntry" ADD COLUMN "paystackCode" TEXT;
ALTER TABLE "ReimbursementClaim" ADD COLUMN "accountName" TEXT;
ALTER TABLE "ReimbursementClaim" ADD COLUMN "accountVerifiedAt" TIMESTAMP(3);
