import { getDb } from "@/lib/db";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";
import { downloadObject, uploadObject } from "@/lib/storage";
import { can, isItfRole, type Role } from "@/lib/rbac";

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
  kind: CompanyEvidenceKind;
  file: File;
};

export type DownloadCompanyEvidenceInput = {
  companyId: string;
  documentId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export function getCompanyEvidenceKinds() {
  return companyEvidenceKinds;
}

export async function uploadCompanyEvidence(input: UploadCompanyEvidenceInput) {
  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  const user = await db.user.findUnique({
    where: {
      email: input.uploadedByEmail,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("Upload user was not found. Run the foundation seed first.");
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

export async function downloadCompanyEvidence(input: DownloadCompanyEvidenceInput) {
  if (!can(input.requesterRole, "company:read")) {
    throw new Error("You do not have permission to read company documents.");
  }

  const db = getDb();
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
      },
    },
    select: {
      id: true,
      organizationId: true,
      fileName: true,
      storageProvider: true,
      bucket: true,
      objectKey: true,
      mimeType: true,
      fileSize: true,
      access: true,
    },
  });

  if (!document) {
    return null;
  }

  if (document.access !== "PRIVATE") {
    throw new Error("Unsupported document access policy.");
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
    requester.memberships.some((membership) => membership.organizationId === document.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this organization's evidence.");
  }

  const downloaded = await downloadObject({
    storageProvider: document.storageProvider,
    bucket: document.bucket,
    objectKey: document.objectKey,
  });

  return {
    buffer: downloaded.buffer,
    fileName: document.fileName,
    fileSize: downloaded.fileSize,
    mimeType: document.mimeType,
  };
}
