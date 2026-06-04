import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const claimEvidenceKinds = [
  "ATTENDANCE_SHEET",
  "PAYMENT_RECEIPT",
  "TRAINING_REPORT",
  "TRAINING_PHOTO",
  "CERTIFICATE",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

export type ClaimEvidenceKind = (typeof claimEvidenceKinds)[number];

export type CreateClaimFromTrainingRequestInput = {
  trainingRequestId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type UpdateClaimFormInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  claimYear?: number;
  trainingContributionDue?: number;
  trainingContributionPaid?: number;
  itfReceiptNumber?: string;
  bankName?: string;
  accountNumber?: string;
  sortCode?: string;
  claimedAmount: number;
  employerOfficerName?: string;
  employerOfficerRank?: string;
  chiefExecutiveName?: string;
};

export type UploadClaimEvidenceInput = {
  claimId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: ClaimEvidenceKind;
  file: File;
};

export type UpdateClaimRecommendationInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  eligibleAmount?: number;
  claimRecommendedAmount?: number;
  claimRecommendedInWords?: string;
  reviewerRemarks?: string;
};

export function getClaimEvidenceKinds() {
  return claimEvidenceKinds;
}

export async function createClaimFromTrainingRequest(
  input: CreateClaimFromTrainingRequestInput,
) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to create reimbursement claims.");
  }

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.trainingRequestId,
      status: "APPROVED",
      recordTier: "HOT",
      monitoringRecords: {
        some: {
          status: "APPROVED",
          recordTier: "HOT",
        },
      },
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      startsAt: true,
      estimatedCost: true,
      company: {
        select: {
          organizationId: true,
          itfEmployerNumber: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Claims can only be created from approved and monitored Training Approval Requests.");
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
    requester.memberships.some(
      (membership) => membership.organizationId === request.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to create a claim for this training.");
  }

  const existingClaim = await db.reimbursementClaim.findFirst({
    where: {
      trainingRequestId: request.id,
      recordTier: "HOT",
    },
    select: {
      id: true,
    },
  });

  if (existingClaim) {
    return existingClaim;
  }

  return db.reimbursementClaim.create({
    data: {
      companyId: request.companyId,
      trainingRequestId: request.id,
      reference: buildClaimReference(request.startsAt),
      claimYear: request.startsAt.getFullYear(),
      itfReceiptNumber: request.company.itfEmployerNumber,
      claimedAmount: request.estimatedCost,
      status: "DRAFT",
    },
    select: {
      id: true,
    },
  });
}

function buildClaimReference(date: Date) {
  return `TR-${date.getFullYear()}-${Date.now()}`;
}

export async function updateClaimForm(input: UpdateClaimFormInput) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to update reimbursement claims.");
  }

  if (!Number.isFinite(input.claimedAmount) || input.claimedAmount <= 0) {
    throw new Error("Claimed amount must be greater than zero.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      status: "DRAFT",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Editable reimbursement claim was not found.");
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
    requester.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to update this claim.");
  }

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      claimYear: input.claimYear,
      trainingContributionDue: input.trainingContributionDue,
      trainingContributionPaid: input.trainingContributionPaid,
      itfReceiptNumber: input.itfReceiptNumber,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      sortCode: input.sortCode,
      claimedAmount: input.claimedAmount,
      employerOfficerName: input.employerOfficerName,
      employerOfficerRank: input.employerOfficerRank,
      chiefExecutiveName: input.chiefExecutiveName,
      employerDeclaredAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}

export async function uploadClaimEvidence(input: UploadClaimEvidenceInput) {
  if (!can(input.requesterRole, "claims:submit") && !can(input.requesterRole, "claims:review")) {
    throw new Error("You do not have permission to upload claim evidence.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      company: {
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

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  const actor = await db.user.findUnique({
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

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to upload evidence for this claim.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: claim.companyId,
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "claims",
  });

  return db.document.create({
    data: {
      organizationId: claim.company.organizationId,
      companyId: claim.companyId,
      reimbursementClaimId: claim.id,
      uploadedById: actor.id,
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

export async function updateClaimRecommendation(input: UpdateClaimRecommendationInput) {
  if (!can(input.requesterRole, "claims:review")) {
    throw new Error("You do not have permission to recommend reimbursement claims.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess =
    input.requesterRole === "SYSTEM_ADMIN" ||
    input.requesterRole === "WORKSPACE_APP_ADMIN" ||
    input.requesterRole === "HEAD_OF_DIVISION" ||
    input.requesterRole === "DIRECTOR_FSD" ||
    input.requesterRole === "HQ_REIMBURSEMENT_OFFICER" ||
    actor.memberships.some((membership) => membership.areaOfficeId === claim.company.areaOfficeId);

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to recommend this Area Office claim.");
  }

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      eligibleAmount: input.eligibleAmount,
      claimRecommendedAmount: input.claimRecommendedAmount,
      claimRecommendedInWords: input.claimRecommendedInWords,
      paymentDetails: input.reviewerRemarks,
    },
    select: {
      id: true,
    },
  });
}
