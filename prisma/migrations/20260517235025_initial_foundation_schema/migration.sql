-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SYSTEM_ADMIN', 'WORKSPACE_APP_ADMIN', 'ITF_REGISTRATION_OFFICER', 'ITF_COMPLIANCE_OFFICER', 'ITF_TRAINING_APPROVER', 'ITF_CLAIMS_REVIEWER', 'ITF_CLAIMS_APPROVER', 'ITF_AUDITOR', 'EMPLOYER_ADMIN', 'EMPLOYER_SUBMITTER', 'EMPLOYER_VIEWER');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('ITF_INTERNAL', 'EMPLOYER');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'DEACTIVATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CAC_CERTIFICATE', 'TAX_CLEARANCE_CERTIFICATE', 'AUDITED_ACCOUNT', 'CONTRIBUTION_RECEIPT', 'LEARNING_POLICY', 'TRAINING_POLICY', 'ANNUAL_TRAINING_PLAN', 'ATTENDANCE_SHEET', 'PAYMENT_RECEIPT', 'TRAINING_REPORT', 'TRAINING_PHOTO', 'CERTIFICATE', 'SIGNED_DECLARATION', 'OFFICIAL_STAMPED_COPY', 'OTHER_SUPPORTING_EVIDENCE');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('VERCEL_BLOB', 'S3');

-- CreateEnum
CREATE TYPE "DocumentAccess" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SETTLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecordTier" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'RECOMMEND', 'CERTIFY', 'SETTLE', 'REOPEN');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('INTERNAL', 'EMPLOYER_VISIBLE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DEACTIVATE', 'REVOKE', 'ARCHIVE', 'LOGIN', 'UPLOAD_DOCUMENT', 'REVOKE_DOCUMENT', 'CHANGE_RECORD_TIER', 'SETTLE', 'REOPEN');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "organizationType" "OrganizationType" NOT NULL DEFAULT 'EMPLOYER',
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "rcNumber" TEXT,
    "taxId" TEXT,
    "itfEmployerNumber" TEXT,
    "businessAddress" TEXT,
    "postalAddress" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "natureOfBusiness" TEXT,
    "establishedAt" TIMESTAMP(3),
    "payrollBasis" DECIMAL(14,2),
    "status" "CompanyStatus" NOT NULL DEFAULT 'DRAFT',
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceYear" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nigerianEmployeeCount" INTEGER,
    "expatriateEmployeeCount" INTEGER,
    "totalEmployeeCount" INTEGER,
    "turnover" DECIMAL(14,2),
    "payrollTotal" DECIMAL(14,2),
    "contributionAmount" DECIMAL(14,2),
    "amountPaid" DECIMAL(14,2),
    "amountPaidInWords" TEXT,
    "paymentMode" TEXT,
    "contributionPaidAt" TIMESTAMP(3),
    "annualPlanSubmittedAt" TIMESTAMP(3),
    "declarationName" TEXT,
    "declarationPosition" TEXT,
    "declarationPhone" TEXT,
    "declaredAt" TIMESTAMP(3),
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceBranchReturn" (
    "id" TEXT NOT NULL,
    "complianceYearId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "employeeCount" INTEGER,
    "payrollTotal" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceBranchReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trainingType" TEXT,
    "provider" TEXT NOT NULL,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "participantCount" INTEGER,
    "estimatedCost" DECIMAL(14,2) NOT NULL,
    "expectedOutcome" TEXT,
    "approvalReference" TEXT,
    "approvedOriginalRef" TEXT,
    "approvedDuplicateRef" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingParticipant" (
    "id" TEXT NOT NULL,
    "trainingRequestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trainingArea" TEXT,
    "educationalQualification" TEXT,
    "jobTitle" TEXT,
    "nationality" TEXT,
    "courseTitle" TEXT,
    "courseSynopsis" TEXT,
    "courseOrganiser" TEXT,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "approvalRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trainingRequestId" TEXT,
    "reference" TEXT NOT NULL,
    "claimYear" INTEGER,
    "trainingContributionDue" DECIMAL(14,2),
    "trainingContributionPaid" DECIMAL(14,2),
    "maxReimbursableAmount" DECIMAL(14,2),
    "itfReceiptNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "sortCode" TEXT,
    "claimedAmount" DECIMAL(14,2) NOT NULL,
    "eligibleAmount" DECIMAL(14,2),
    "claimRecommendedAmount" DECIMAL(14,2),
    "claimRecommendedInWords" TEXT,
    "paymentDetails" TEXT,
    "employerOfficerName" TEXT,
    "employerOfficerRank" TEXT,
    "chiefExecutiveName" TEXT,
    "employerDeclaredAt" TIMESTAMP(3),
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementClaimLine" (
    "id" TEXT NOT NULL,
    "reimbursementClaimId" TEXT NOT NULL,
    "trainingArea" TEXT NOT NULL,
    "totalWorkforce" INTEGER,
    "totalTrained" INTEGER,
    "percentTrained" DECIMAL(5,2),
    "emphasisNumber" INTEGER,
    "contributionPaid" DECIMAL(14,2),
    "employerClaimAmount" DECIMAL(14,2),
    "referencePage" TEXT,
    "percentAwarded" DECIMAL(5,2),
    "amountAwarded" DECIMAL(14,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementClaimLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "complianceYearId" TEXT,
    "trainingRequestId" TEXT,
    "reimbursementClaimId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL,
    "bucket" TEXT,
    "objectKey" TEXT NOT NULL,
    "url" TEXT,
    "etag" TEXT,
    "versionId" TEXT,
    "checksum" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "access" "DocumentAccess" NOT NULL DEFAULT 'PRIVATE',
    "classification" TEXT NOT NULL DEFAULT 'OFFICIAL',
    "retentionPolicy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "companyId" TEXT,
    "complianceYearId" TEXT,
    "trainingRequestId" TEXT,
    "reimbursementClaimId" TEXT,
    "documentId" TEXT,
    "action" "DecisionAction" NOT NULL,
    "reason" TEXT,
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "companyId" TEXT,
    "complianceYearId" TEXT,
    "trainingRequestId" TEXT,
    "reimbursementClaimId" TEXT,
    "documentId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_externalId_key" ON "Workspace"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_workspaceId_slug_key" ON "Organization"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_organizationId_role_key" ON "Membership"("userId", "workspaceId", "organizationId", "role");

-- CreateIndex
CREATE INDEX "Company_organizationId_status_recordTier_idx" ON "Company"("organizationId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "ComplianceYear_companyId_status_recordTier_idx" ON "ComplianceYear"("companyId", "status", "recordTier");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceYear_companyId_year_key" ON "ComplianceYear"("companyId", "year");

-- CreateIndex
CREATE INDEX "ComplianceBranchReturn_complianceYearId_idx" ON "ComplianceBranchReturn"("complianceYearId");

-- CreateIndex
CREATE INDEX "TrainingRequest_companyId_status_recordTier_idx" ON "TrainingRequest"("companyId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "TrainingParticipant_trainingRequestId_idx" ON "TrainingParticipant"("trainingRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementClaim_reference_key" ON "ReimbursementClaim"("reference");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_companyId_status_recordTier_idx" ON "ReimbursementClaim"("companyId", "status", "recordTier");

-- CreateIndex
CREATE INDEX "ReimbursementClaimLine_reimbursementClaimId_idx" ON "ReimbursementClaimLine"("reimbursementClaimId");

-- CreateIndex
CREATE INDEX "Document_organizationId_kind_recordTier_isActive_idx" ON "Document"("organizationId", "kind", "recordTier", "isActive");

-- CreateIndex
CREATE INDEX "Decision_actorId_recordTier_createdAt_idx" ON "Decision"("actorId", "recordTier", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_actorId_recordTier_createdAt_idx" ON "Comment"("actorId", "recordTier", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_entityType_entityId_createdAt_idx" ON "AuditEvent"("workspaceId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_recordTier_createdAt_idx" ON "AuditEvent"("workspaceId", "recordTier", "createdAt");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceYear" ADD CONSTRAINT "ComplianceYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceBranchReturn" ADD CONSTRAINT "ComplianceBranchReturn_complianceYearId_fkey" FOREIGN KEY ("complianceYearId") REFERENCES "ComplianceYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRequest" ADD CONSTRAINT "TrainingRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_trainingRequestId_fkey" FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_trainingRequestId_fkey" FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaimLine" ADD CONSTRAINT "ReimbursementClaimLine_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_complianceYearId_fkey" FOREIGN KEY ("complianceYearId") REFERENCES "ComplianceYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_trainingRequestId_fkey" FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_complianceYearId_fkey" FOREIGN KEY ("complianceYearId") REFERENCES "ComplianceYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_trainingRequestId_fkey" FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_complianceYearId_fkey" FOREIGN KEY ("complianceYearId") REFERENCES "ComplianceYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_trainingRequestId_fkey" FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
