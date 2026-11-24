import { getDb } from "@/lib/db";
import { assertDocumentSafe } from "@/lib/document-security";
import { isEvidenceWorkflowEditable } from "@/lib/evidence-deletion";
import { normalizeEvidenceDocumentName } from "@/lib/evidence-metadata";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";
import { openObject, uploadObject } from "@/lib/storage";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { canBrowseArchivedClaims, getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { canDownloadArchivedRawEvidence, parseArchivedPaymentPacket } from "@/lib/reimbursement-archive-packet";
import { getAreaOfficeOfficerRoles } from "@/lib/area-office-management";

const companyEvidenceKinds = [
  "CAC_CERTIFICATE",
  "TAX_CLEARANCE_CERTIFICATE",
  "AUDITED_ACCOUNT",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

export type CompanyEvidenceKind = (typeof companyEvidenceKinds)[number];

export type UploadCompanyEvidenceInput = {
  companyId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: CompanyEvidenceKind;
  documentName?: string;
  file: File;
};

export type DownloadCompanyEvidenceInput = {
  companyId: string;
  documentId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type DeleteCompanyEvidenceInput = {
  companyId: string;
  documentId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export function getCompanyEvidenceKinds() {
  return companyEvidenceKinds;
}

export async function uploadCompanyEvidence(input: UploadCompanyEvidenceInput) {
  if (isItfRole(input.requesterRole) || !can(input.requesterRole, "registry:submit")) {
    throw new Error("Only an employer submitter can upload company evidence.");
  }
  const documentName = normalizeEvidenceDocumentName(input.kind, input.documentName);

  await assertUploadRateLimit(input.uploadedByEmail);

  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      organizationId: true,
      isActive: true,
      registrationApplication: { select: { status: true } },
      complianceYears: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
      trainingPlanSubmissions: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
      trainingRequests: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
      reimbursementClaims: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  if (!company.isActive || !isEvidenceWorkflowEditable([company.registrationApplication?.status]) ||
    company.complianceYears.length || company.trainingPlanSubmissions.length || company.trainingRequests.length || company.reimbursementClaims.length) {
    throw new Error("Submitted company evidence is locked. Employer correction requests are limited to company details.");
  }

  const user = await db.user.findUnique({
    where: {
      email: input.uploadedByEmail,
    },
    select: {
      id: true,
      memberships: { where: { isActive: true, role: input.requesterRole }, select: { organizationId: true } },
    },
  });

  if (!user) {
    throw new Error("Upload user was not found. Run the foundation seed first.");
  }

  if (!user.memberships.some((membership) => membership.organizationId === company.organizationId)) {
    throw new Error("You do not have access to upload evidence for this company.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: company.id,
    extension: validated.extension,
    mimeType: validated.mimeType,
  });

  return db.document.create({
    data: {
      organizationId: company.organizationId,
      companyId: company.id,
      uploadedById: user.id,
      kind: input.kind,
      documentName,
      fileName: safeFileName,
      storageProvider: stored.storageProvider,
      scanStatus: stored.scanStatus,
      scannedAt: stored.scannedAt,
      scanReason: stored.scanReason,
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

export async function downloadCompanyEvidence(input: DownloadCompanyEvidenceInput) {
  if (!can(input.requesterRole, "company:read")) {
    throw new Error("You do not have permission to read company documents.");
  }

  const db = getDb();
  if (isItfRole(input.requesterRole) && !await db.membership.findFirst({
    where: { user: { email: input.requesterEmail, isActive: true }, isActive: true, role: input.requesterRole },
    select: { id: true },
  })) return null;
  const areaOfficeRole = getAreaOfficeOfficerRoles().some((role) => role === input.requesterRole);
  const allowedAreaOfficeIds = areaOfficeRole
    ? (await db.membership.findMany({
        where: {
          user: { email: input.requesterEmail, isActive: true },
          isActive: true,
          role: input.requesterRole,
          areaOfficeId: { not: null },
        },
        select: { areaOfficeId: true },
      })).map((membership) => membership.areaOfficeId).filter((id): id is string => Boolean(id))
    : [];
  const document = await db.document.findFirst({
    where: {
      id: input.documentId,
      companyId: input.companyId,
      isActive: true,
      recordTier: "HOT",
      revokedAt: null,
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
        ...(areaOfficeRole ? { areaOfficeId: { in: allowedAreaOfficeIds } } : {}),
      },
    },
    select: {
      id: true,
      organizationId: true,
      reimbursementClaimId: true,
      kind: true,
      fileName: true,
      storageProvider: true,
      bucket: true,
      objectKey: true,
      mimeType: true,
      fileSize: true,
      access: true,
      scanStatus: true,
      scanReason: true,
    },
  });

  if (!document) {
    return null;
  }

  if (document.reimbursementClaimId) {
    const visibilityWhere = await getClaimVisibilityWhere({ email: input.requesterEmail, role: input.requesterRole });
    const visibleClaim = await db.reimbursementClaim.findFirst({
      where: { id: document.reimbursementClaimId, recordTier: "HOT", AND: [visibilityWhere] },
      select: { id: true },
    });
    if (!visibleClaim) return null;
  }

  if (["AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"].includes(input.requesterRole) &&
    document.kind === "TRAINING_PLAN_DOCUMENT") {
    throw new Error("Area Office officers can view the training plan only through its PDF view.");
  }

  if (document.access !== "PRIVATE") {
    throw new Error("Unsupported document access policy.");
  }
  assertDocumentSafe(document);

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        where: { isActive: true },
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
    requester.memberships.some((membership) => membership.organizationId === document.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this organization's evidence.");
  }

  const downloaded = await openObject({
    storageProvider: document.storageProvider,
    bucket: document.bucket,
    objectKey: document.objectKey,
  });

  return {
    stream: downloaded.stream,
    fileName: document.fileName,
    fileSize: downloaded.fileSize,
    mimeType: document.mimeType,
  };
}

/** Archive links are claim-scoped and checked again at click time, not presigned storage URLs. */
export async function downloadArchivedClaimEvidence(input: Omit<DownloadCompanyEvidenceInput, "companyId"> & { claimId: string }) {
  if (!canBrowseArchivedClaims(input.requesterRole)) return null;
  const db = getDb();
  const visibility = await getClaimVisibilityWhere({ email: input.requesterEmail, role: input.requesterRole });
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, status: "ARCHIVED", recordTier: "HOT", AND: [visibility] },
    select: { companyId: true, archiveSnapshot: true },
  });
  const packet = parseArchivedPaymentPacket(claim?.archiveSnapshot);
  if (!claim || !canDownloadArchivedRawEvidence(packet, input.documentId)) return null;
  const document = await db.document.findFirst({
    where: { id: input.documentId, companyId: claim.companyId, isActive: true, revokedAt: null, recordTier: "HOT" },
    select: { storageProvider: true, bucket: true, objectKey: true, fileName: true, mimeType: true,
      access: true, scanStatus: true, scanReason: true },
  });
  if (!document) return null;
  if (document.access !== "PRIVATE") throw new Error("Unsupported document access policy.");
  assertDocumentSafe(document);
  const downloaded = await openObject({
    storageProvider: document.storageProvider, bucket: document.bucket, objectKey: document.objectKey,
  });
  return { stream: downloaded.stream, fileName: document.fileName,
    fileSize: downloaded.fileSize, mimeType: document.mimeType };
}

export async function deleteCompanyEvidence(input: DeleteCompanyEvidenceInput) {
  if (isItfRole(input.requesterRole)) {
    throw new Error("ITF officers cannot remove employer-uploaded evidence.");
  }

  if (!can(input.requesterRole, "company:manage") && !can(input.requesterRole, "registry:submit")) {
    throw new Error("You do not have permission to remove evidence documents.");
  }

  const db = getDb();
  const document = await db.document.findFirst({
    where: {
      id: input.documentId,
      companyId: input.companyId,
      isActive: true,
      recordTier: "HOT",
      revokedAt: null,
      kind: {
        notIn: ["CERTIFICATE", "CERTIFICATE_TEMPLATE_DESIGN", "SIGNATURE_IMAGE"],
      },
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      organizationId: true,
      companyId: true,
      complianceYearId: true,
      trainingPlanSubmissionId: true,
      trainingRequestId: true,
      trainingMonitoringRecordId: true,
      reimbursementClaimId: true,
      fileName: true,
      uploadedBy: {
        select: {
          memberships: {
            where: { isActive: true },
            select: { role: true },
          },
        },
      },
      company: {
        select: {
          registrationApplication: {
            select: { status: true },
          },
          complianceYears: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
          trainingPlanSubmissions: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
          trainingRequests: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
          reimbursementClaims: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
        },
      },
      registrationApplication: {
        select: { status: true },
      },
      complianceYear: {
        select: { status: true },
      },
      trainingPlanSubmission: {
        select: { status: true },
      },
      trainingRequest: {
        select: { status: true },
      },
      trainingMonitoringRecord: {
        select: { status: true },
      },
      reimbursementClaim: {
        select: { status: true },
      },
    },
  });

  if (!document) {
    throw new Error("Evidence document was not found.");
  }

  if (document.uploadedBy.memberships.some((membership) => isItfRole(membership.role))) {
    throw new Error("Employer users cannot remove evidence uploaded by ITF officers.");
  }

  if (
    !isEvidenceWorkflowEditable([
      document.registrationApplication?.status ??
        (document.complianceYearId ||
        document.trainingPlanSubmissionId ||
        document.trainingRequestId ||
        document.trainingMonitoringRecordId ||
        document.reimbursementClaimId
          ? null
          : document.company?.registrationApplication?.status),
      document.complianceYear?.status,
      document.trainingPlanSubmission?.status,
      document.trainingRequest?.status,
      document.trainingMonitoringRecord?.status,
      document.reimbursementClaim?.status,
    ]) || (!document.registrationApplication && !document.complianceYear && !document.trainingPlanSubmission &&
      !document.trainingRequest && !document.trainingMonitoringRecord && !document.reimbursementClaim &&
      Boolean(document.company?.complianceYears.length || document.company?.trainingPlanSubmissions.length || document.company?.trainingRequests.length || document.company?.reimbursementClaims.length))
  ) {
    throw new Error("Submitted evidence is permanently locked and cannot be removed.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess = requester.memberships.some(
    (membership) => membership.organizationId === document.organizationId,
  );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this organization's evidence.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: {
        id: document.id,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    await tx.comment.create({
      data: {
        actorId: requester.id,
        companyId: document.companyId,
        complianceYearId: document.complianceYearId,
        trainingPlanSubmissionId: document.trainingPlanSubmissionId,
        documentId: document.id,
        body: `Evidence document removed from active view: ${document.fileName}`,
        visibility: "INTERNAL",
      },
    });

    return updated;
  });
}
