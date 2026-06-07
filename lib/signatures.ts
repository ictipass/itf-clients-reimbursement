import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";
import { downloadObject, uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const signatureAssetKinds = [
  "DIRECTOR_GENERAL_CE",
  "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE",
] as const;

export type SignatureAssetKind = (typeof signatureAssetKinds)[number];

export type UploadSignatureAssetInput = {
  requesterEmail: string;
  requesterRole: Role;
  workspaceId: string;
  kind: SignatureAssetKind;
  label: string;
  effectiveFrom?: Date;
  file: File;
};

export type DownloadSignatureAssetInput = {
  signatureAssetId: string;
  requesterRole: Role;
};

export function getSignatureAssetKinds() {
  return signatureAssetKinds;
}

export async function listSignatureAssetWorkspaces() {
  const db = getDb();

  return db.workspace.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listSignatureAssets(input: { requesterRole: Role }) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage signature assets.");
  }

  const db = getDb();

  return db.signatureAsset.findMany({
    where: {
      recordTier: "HOT",
    },
    select: {
      id: true,
      kind: true,
      label: true,
      effectiveFrom: true,
      retiredAt: true,
      isActive: true,
      createdAt: true,
      workspace: {
        select: {
          name: true,
        },
      },
      document: {
        select: {
          fileName: true,
          mimeType: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function uploadSignatureAsset(input: UploadSignatureAssetInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage signature assets.");
  }

  const label = input.label.trim();

  if (!label) {
    throw new Error("Signature label is required.");
  }

  if (!signatureAssetKinds.includes(input.kind)) {
    throw new Error("Unsupported signature asset kind.");
  }

  const db = getDb();
  const workspace = await db.workspace.findFirst({
    where: {
      id: input.workspaceId,
      isActive: true,
    },
    select: {
      id: true,
      organizations: {
        where: {
          organizationType: "ITF_INTERNAL",
          isActive: true,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!workspace) {
    throw new Error("Workspace was not found.");
  }

  const organization = workspace.organizations[0];

  if (!organization) {
    throw new Error("ITF internal organization was not found for this workspace.");
  }

  const uploader = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
    },
  });

  if (!uploader) {
    throw new Error("Upload user was not found.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);

  if (validated.mimeType !== "image/png" && validated.mimeType !== "image/jpeg") {
    throw new Error("Signatures must be PNG or JPEG image files.");
  }

  const stored = await uploadObject({
    buffer,
    companyId: input.kind.toLowerCase(),
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "signature-assets",
  });
  const now = new Date();

  return db.$transaction(async (tx) => {
    await tx.signatureAsset.updateMany({
      where: {
        workspaceId: workspace.id,
        kind: input.kind,
        isActive: true,
        recordTier: "HOT",
      },
      data: {
        isActive: false,
        retiredAt: now,
      },
    });

    const document = await tx.document.create({
      data: {
        organizationId: organization.id,
        uploadedById: uploader.id,
        kind: "SIGNATURE_IMAGE",
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

    return tx.signatureAsset.create({
      data: {
        workspaceId: workspace.id,
        documentId: document.id,
        kind: input.kind,
        label,
        effectiveFrom: input.effectiveFrom,
      },
      select: {
        id: true,
      },
    });
  });
}

export async function downloadSignatureAsset(input: DownloadSignatureAssetInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to view signature assets.");
  }

  const db = getDb();
  const signatureAsset = await db.signatureAsset.findFirst({
    where: {
      id: input.signatureAssetId,
      recordTier: "HOT",
    },
    select: {
      document: {
        select: {
          fileName: true,
          storageProvider: true,
          bucket: true,
          objectKey: true,
          mimeType: true,
          fileSize: true,
          access: true,
          isActive: true,
          recordTier: true,
          revokedAt: true,
        },
      },
    },
  });

  const document = signatureAsset?.document;

  if (
    !document ||
    !document.isActive ||
    document.recordTier !== "HOT" ||
    document.revokedAt ||
    document.access !== "PRIVATE"
  ) {
    return null;
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
