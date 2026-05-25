import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

type CertificateTemplateReader = Pick<ReturnType<typeof getDb>, "certificateTemplate">;

export type UploadCertificateTemplateDesignInput = {
  templateId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  file: File;
};

export type CreateCertificateTemplateInput = {
  requesterRole: Role;
  workspaceId: string;
  name: string;
  code: string;
  version: string;
  effectiveFrom?: Date;
  notes?: string;
};

export type UpdateCertificateTemplateStatusInput = {
  requesterRole: Role;
  templateId: string;
};

export async function findActiveCertificateTemplate(
  db: CertificateTemplateReader,
  workspaceId: string,
  issuedAt = new Date(),
) {
  const datedTemplate = await db.certificateTemplate.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      recordTier: "HOT",
      effectiveFrom: {
        lte: issuedAt,
      },
    },
    select: {
      id: true,
      name: true,
      version: true,
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (datedTemplate) {
    return datedTemplate;
  }

  return db.certificateTemplate.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      recordTier: "HOT",
      effectiveFrom: null,
    },
    select: {
      id: true,
      name: true,
      version: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function listCertificateTemplates() {
  const db = getDb();

  return db.certificateTemplate.findMany({
    where: {
      recordTier: "HOT",
    },
    select: {
      id: true,
      name: true,
      code: true,
      version: true,
      status: true,
      effectiveFrom: true,
      retiredAt: true,
      designDocumentId: true,
      designDocument: {
        select: {
          fileName: true,
          mimeType: true,
          createdAt: true,
        },
      },
      notes: true,
      createdAt: true,
      updatedAt: true,
      workspace: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          certificates: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}

export async function listCertificateTemplateWorkspaces() {
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

export async function createCertificateTemplate(input: CreateCertificateTemplateInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage certificate templates.");
  }

  const name = input.name.trim();
  const code = normalizeTemplateCode(input.code);
  const version = input.version.trim();
  const notes = input.notes?.trim() || undefined;

  if (!name) {
    throw new Error("Template name is required.");
  }

  if (!code) {
    throw new Error("Template code is required.");
  }

  if (!version) {
    throw new Error("Template version is required.");
  }

  const db = getDb();

  return db.certificateTemplate.create({
    data: {
      workspaceId: input.workspaceId,
      name,
      code,
      version,
      status: "DRAFT",
      effectiveFrom: input.effectiveFrom,
      notes,
    },
    select: {
      id: true,
    },
  });
}

export async function activateCertificateTemplate(input: UpdateCertificateTemplateStatusInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage certificate templates.");
  }

  const db = getDb();
  const template = await db.certificateTemplate.findFirst({
    where: {
      id: input.templateId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      workspaceId: true,
      code: true,
      effectiveFrom: true,
    },
  });

  if (!template) {
    throw new Error("Certificate template was not found.");
  }

  const now = new Date();

  return db.$transaction(async (tx) => {
    await tx.certificateTemplate.updateMany({
      where: {
        workspaceId: template.workspaceId,
        code: template.code,
        status: "ACTIVE",
        recordTier: "HOT",
        id: {
          not: template.id,
        },
      },
      data: {
        status: "RETIRED",
        retiredAt: now,
      },
    });

    return tx.certificateTemplate.update({
      where: {
        id: template.id,
      },
      data: {
        status: "ACTIVE",
        effectiveFrom: template.effectiveFrom ?? now,
        retiredAt: null,
      },
      select: {
        id: true,
      },
    });
  });
}

export async function retireCertificateTemplate(input: UpdateCertificateTemplateStatusInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage certificate templates.");
  }

  const db = getDb();

  return db.certificateTemplate.update({
    where: {
      id: input.templateId,
    },
    data: {
      status: "RETIRED",
      retiredAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}

export async function uploadCertificateTemplateDesign(
  input: UploadCertificateTemplateDesignInput,
) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage certificate templates.");
  }

  const db = getDb();
  const template = await db.certificateTemplate.findFirst({
    where: {
      id: input.templateId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      workspaceId: true,
      code: true,
      version: true,
      workspace: {
        select: {
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
      },
    },
  });

  if (!template) {
    throw new Error("Certificate template was not found.");
  }

  const organization = template.workspace.organizations[0];

  if (!organization) {
    throw new Error("ITF internal organization was not found for this workspace.");
  }

  const uploader = await db.user.findUnique({
    where: {
      email: input.uploadedByEmail,
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
  const stored = await uploadObject({
    buffer,
    companyId: `${template.code.toLowerCase()}-${template.version.toLowerCase()}`,
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "certificate-templates",
  });

  return db.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        organizationId: organization.id,
        uploadedById: uploader.id,
        kind: "CERTIFICATE_TEMPLATE_DESIGN",
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

    return tx.certificateTemplate.update({
      where: {
        id: template.id,
      },
      data: {
        designDocumentId: document.id,
      },
      select: {
        id: true,
      },
    });
  });
}

function normalizeTemplateCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
