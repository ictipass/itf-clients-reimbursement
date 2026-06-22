ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DIRECTOR_GENERAL';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE';

CREATE TYPE "TrainingDeliveryMode" AS ENUM ('LOCAL_PHYSICAL', 'LOCAL_ONLINE');
CREATE TYPE "JurisdictionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TABLE "User"
  ADD COLUMN "isManagement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "calendarFeedEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "calendarFeedToken" TEXT;

CREATE UNIQUE INDEX "User_calendarFeedToken_key" ON "User"("calendarFeedToken");

ALTER TABLE "TrainingRequest"
  ADD COLUMN "isAdHoc" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adHocJustification" TEXT,
  ADD COLUMN "deliveryMode" "TrainingDeliveryMode" NOT NULL DEFAULT 'LOCAL_PHYSICAL',
  ADD COLUMN "onlineUrl" TEXT,
  ADD COLUMN "onlinePassword" TEXT,
  ADD COLUMN "onlineMeetingId" TEXT,
  ADD COLUMN "onlineInstructions" TEXT,
  ADD COLUMN "trainingDetailsUpdatedAt" TIMESTAMP(3);

CREATE TABLE "JurisdictionChangeRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fromAreaOfficeId" TEXT,
  "toAreaOfficeId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reason" TEXT NOT NULL,
  "reviewNote" TEXT,
  "status" "JurisdictionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JurisdictionChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JurisdictionChangeRequest_companyId_status_idx"
  ON "JurisdictionChangeRequest"("companyId", "status");
CREATE INDEX "JurisdictionChangeRequest_fromAreaOfficeId_status_idx"
  ON "JurisdictionChangeRequest"("fromAreaOfficeId", "status");
CREATE INDEX "JurisdictionChangeRequest_toAreaOfficeId_status_idx"
  ON "JurisdictionChangeRequest"("toAreaOfficeId", "status");

ALTER TABLE "JurisdictionChangeRequest"
  ADD CONSTRAINT "JurisdictionChangeRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JurisdictionChangeRequest"
  ADD CONSTRAINT "JurisdictionChangeRequest_fromAreaOfficeId_fkey"
  FOREIGN KEY ("fromAreaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JurisdictionChangeRequest"
  ADD CONSTRAINT "JurisdictionChangeRequest_toAreaOfficeId_fkey"
  FOREIGN KEY ("toAreaOfficeId") REFERENCES "AreaOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JurisdictionChangeRequest"
  ADD CONSTRAINT "JurisdictionChangeRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JurisdictionChangeRequest"
  ADD CONSTRAINT "JurisdictionChangeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
