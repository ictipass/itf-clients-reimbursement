-- CreateEnum
CREATE TYPE "ManagedNumberType" AS ENUM ('ITF_EMPLOYER_NUMBER', 'REGISTRATION_CERTIFICATE_NUMBER');

-- CreateEnum
CREATE TYPE "ManagedNumberStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'VOIDED');

-- CreateTable
CREATE TABLE "ManagedRegistrationNumber" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ManagedNumberType" NOT NULL,
    "value" TEXT NOT NULL,
    "status" "ManagedNumberStatus" NOT NULL DEFAULT 'AVAILABLE',
    "policyCode" TEXT,
    "batchCode" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "assignedCompanyId" TEXT,
    "assignedCertificateId" TEXT,
    "createdById" TEXT,
    "reservedById" TEXT,
    "reservedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedRegistrationNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedRegistrationNumber_workspaceId_type_status_recordTie_idx" ON "ManagedRegistrationNumber"("workspaceId", "type", "status", "recordTier");

-- CreateIndex
CREATE INDEX "ManagedRegistrationNumber_assignedCompanyId_type_status_idx" ON "ManagedRegistrationNumber"("assignedCompanyId", "type", "status");

-- CreateIndex
CREATE INDEX "ManagedRegistrationNumber_assignedCertificateId_idx" ON "ManagedRegistrationNumber"("assignedCertificateId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedRegistrationNumber_workspaceId_type_value_key" ON "ManagedRegistrationNumber"("workspaceId", "type", "value");

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_assignedCompanyId_fkey" FOREIGN KEY ("assignedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_assignedCertificateId_fkey" FOREIGN KEY ("assignedCertificateId") REFERENCES "RegistrationCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRegistrationNumber" ADD CONSTRAINT "ManagedRegistrationNumber_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
