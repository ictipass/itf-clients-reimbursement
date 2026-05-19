import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const complianceEvidenceKinds = [
  "CONTRIBUTION_RECEIPT",
  "LEARNING_POLICY",
  "TRAINING_POLICY",
  "ANNUAL_TRAINING_PLAN",
  "SIGNED_DECLARATION",
  "OFFICIAL_STAMPED_COPY",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

export type ComplianceEvidenceKind = (typeof complianceEvidenceKinds)[number];

export type CreateComplianceYearInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  year: number;
  nigerianEmployeeCount?: number;
  expatriateEmployeeCount?: number;
  totalEmployeeCount?: number;
  turnover?: string;
  payrollTotal?: string;
  contributionAmount?: string;
  amountPaid?: string;
  amountPaidInWords?: string;
  paymentMode?: string;
  contributionPaidAt?: Date;
  annualPlanSubmittedAt?: Date;
  declarationName?: string;
  declarationPosition?: string;
  declarationPhone?: string;
  declaredAt?: Date;
};

export type UploadComplianceEvidenceInput = {
  companyId: string;
  complianceYearId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: ComplianceEvidenceKind;
  file: File;
};

export function getComplianceEvidenceKinds() {
  return complianceEvidenceKinds;
}

export async function createComplianceYear(input: CreateComplianceYearInput) {
  if (!can(input.requesterRole, "compliance:submit")) {
    throw new Error("You do not have permission to create compliance returns.");
  }

  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some((membership) => membership.organizationId === company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this company's compliance records.");
  }

  return db.complianceYear.create({
    data: {
      companyId: company.id,
      year: input.year,
      nigerianEmployeeCount: input.nigerianEmployeeCount,
      expatriateEmployeeCount: input.expatriateEmployeeCount,
      totalEmployeeCount: input.totalEmployeeCount,
      turnover: input.turnover,
      payrollTotal: input.payrollTotal,
      contributionAmount: input.contributionAmount,
      amountPaid: input.amountPaid,
      amountPaidInWords: input.amountPaidInWords,
      paymentMode: input.paymentMode,
      contributionPaidAt: input.contributionPaidAt,
      annualPlanSubmittedAt: input.annualPlanSubmittedAt,
      declarationName: input.declarationName,
      declarationPosition: input.declarationPosition,
      declarationPhone: input.declarationPhone,
      declaredAt: input.declaredAt,
      status: "DRAFT",
    },
    select: {
      id: true,
    },
  });
}

export async function getComplianceYearForUpload(companyId: string, complianceYearId: string) {
  const db = getDb();

  return db.complianceYear.findFirst({
    where: {
      id: complianceYearId,
      companyId,
      recordTier: "HOT",
      company: {
        id: companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      status: true,
      company: {
        select: {
          id: true,
          legalName: true,
        },
      },
    },
  });
}

export async function uploadComplianceEvidence(input: UploadComplianceEvidenceInput) {
  if (!can(input.requesterRole, "compliance:submit")) {
    throw new Error("You do not have permission to upload compliance evidence.");
  }

  const db = getDb();
  const complianceYear = await db.complianceYear.findFirst({
    where: {
      id: input.complianceYearId,
      companyId: input.companyId,
      recordTier: "HOT",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!complianceYear) {
    throw new Error("Compliance year was not found.");
  }

  const user = await db.user.findUnique({
    where: {
      email: input.uploadedByEmail,
    },
    select: {
      id: true,
      memberships: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("Upload user was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    user.memberships.some(
      (membership) => membership.organizationId === complianceYear.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this compliance year.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: complianceYear.companyId,
    extension: validated.extension,
    mimeType: validated.mimeType,
  });

  return db.document.create({
    data: {
      organizationId: complianceYear.company.organizationId,
      companyId: complianceYear.companyId,
      complianceYearId: complianceYear.id,
      uploadedById: user.id,
      kind: input.kind,
      fileName: safeFileName,
      storageProvider: stored.storageProvider,
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      url: stored.url,
      etag: stored.etag,
      versionId: stored.versionId,
      checksum: stored.checksum,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      access: "PRIVATE",
      classification: "OFFICIAL",
    },
    select: {
      id: true,
    },
  });
}
