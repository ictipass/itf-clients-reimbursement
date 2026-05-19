import { getDb } from "@/lib/db";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";
import { uploadObject } from "@/lib/storage";

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
