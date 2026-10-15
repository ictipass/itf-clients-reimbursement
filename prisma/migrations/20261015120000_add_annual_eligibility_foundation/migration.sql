ALTER TABLE "Workspace" ADD COLUMN "eligibilityEndpointUrl" TEXT;

CREATE TYPE "AnnualEligibilityStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'INELIGIBLE');

CREATE TABLE "DevelopmentEligibilityRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itfEmployerNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "paymentSettled" BOOLEAN NOT NULL DEFAULT false,
    "contributionPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "certificateIssued" BOOLEAN NOT NULL DEFAULT false,
    "certificateNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DevelopmentEligibilityRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevelopmentEligibilityRecord_workspaceId_itfEmployerNumber_year_key" ON "DevelopmentEligibilityRecord"("workspaceId", "itfEmployerNumber", "year");
ALTER TABLE "DevelopmentEligibilityRecord" ADD CONSTRAINT "DevelopmentEligibilityRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AnnualEligibilityCheck" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "AnnualEligibilityStatus" NOT NULL DEFAULT 'PENDING',
    "contributionPaid" DECIMAL(14,2),
    "certificateNumber" TEXT,
    "checkedAt" TIMESTAMP(3),
    "source" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnnualEligibilityCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnualEligibilityCheck_companyId_year_key" ON "AnnualEligibilityCheck"("companyId", "year");
CREATE INDEX "AnnualEligibilityCheck_status_updatedAt_idx" ON "AnnualEligibilityCheck"("status", "updatedAt");
ALTER TABLE "AnnualEligibilityCheck" ADD CONSTRAINT "AnnualEligibilityCheck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
