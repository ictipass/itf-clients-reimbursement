import { getDb } from "@/lib/db";
import { getVerificationUrl, renderQrPng } from "@/lib/qr";
import { can, canManageAnnualCompliance, isItfRole, type Role } from "@/lib/rbac";
import { downloadObject, uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

export type DownloadCertificateTemplateDesignInput = {
  templateId: string;
  requesterRole: Role;
};

export type PreviewCertificateTemplateInput = {
  templateId: string;
  requesterRole: Role;
};

export type CheckCertificateGenerationReadinessInput = {
  certificateId: string;
  requesterRole: Role;
};

export type GenerateRegistrationCertificatePdfInput = {
  certificateId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type GenerateComplianceCertificatePdfInput = {
  certificateId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type DownloadRegistrationCertificateInput = {
  certificateId: string;
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type DownloadComplianceCertificateInput = {
  certificateId: string;
  companyId: string;
  complianceYearId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type CertificatePlacementPoint = {
  x: number;
  y: number;
  fontSize: number;
};

export type CertificateSignaturePlacementPoint = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CertificatePlacementMetadata = Record<
  (typeof requiredPlacementKeys)[number],
  CertificatePlacementPoint
> &
  Record<(typeof requiredSignaturePlacementKeys)[number], CertificateSignaturePlacementPoint> &
  Record<(typeof requiredQrPlacementKeys)[number], CertificateSignaturePlacementPoint>;

export type UpdateCertificatePlacementMetadataInput = {
  requesterRole: Role;
  templateId: string;
  placementMetadata: CertificatePlacementMetadata;
};

const requiredPlacementKeys = [
  "companyName",
  "itfEmployerNumber",
  "certificateNumber",
  "issuedAt",
] as const;

const requiredSignaturePlacementKeys = [
  "directorGeneralSignature",
  "directorRevenueSignature",
] as const;

const requiredQrPlacementKeys = ["qrCode"] as const;

const requiredSignatureAssets = [
  "DIRECTOR_GENERAL_CE",
  "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE",
] as const;

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
      placementMetadata: true,
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

export async function checkCertificateGenerationReadiness(
  input: CheckCertificateGenerationReadinessInput,
) {
  if (!can(input.requesterRole, "workspace:manage") && !can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to check certificate generation readiness.");
  }

  const db = getDb();
  const certificate = await db.registrationCertificate.findFirst({
    where: {
      id: input.certificateId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      generatedDocumentId: true,
      template: {
        select: {
          id: true,
          workspaceId: true,
          designDocumentId: true,
          placementMetadata: true,
        },
      },
    },
  });

  if (!certificate) {
    throw new Error("Registration certificate was not found.");
  }

  const missing: string[] = [];

  if (!certificate.template) {
    missing.push("certificate template");
  }

  if (certificate.template && !certificate.template.designDocumentId) {
    missing.push("certificate template design");
  }

  const missingPlacementKeys = certificate.template
    ? getMissingPlacementKeys(certificate.template.placementMetadata)
    : [...requiredPlacementKeys];

  if (missingPlacementKeys.length > 0) {
    missing.push(`placement metadata: ${missingPlacementKeys.join(", ")}`);
  }

  if (certificate.template) {
    const missingSignatureAssets = await getMissingSignatureAssets(certificate.template.workspaceId);

    if (missingSignatureAssets.length > 0) {
      missing.push(`signature assets: ${missingSignatureAssets.join(", ")}`);
    }
  }

  return {
    ready: missing.length === 0,
    missing,
    generated: Boolean(certificate.generatedDocumentId),
  };
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

export async function updateCertificatePlacementMetadata(
  input: UpdateCertificatePlacementMetadataInput,
) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage certificate templates.");
  }

  assertPlacementMetadata(input.placementMetadata);

  const db = getDb();

  return db.certificateTemplate.update({
    where: {
      id: input.templateId,
    },
    data: {
      placementMetadata: input.placementMetadata,
    },
    select: {
      id: true,
    },
  });
}

export async function downloadCertificateTemplateDesign(
  input: DownloadCertificateTemplateDesignInput,
) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to view certificate template designs.");
  }

  const db = getDb();
  const template = await db.certificateTemplate.findFirst({
    where: {
      id: input.templateId,
      recordTier: "HOT",
      designDocumentId: {
        not: null,
      },
    },
    select: {
      designDocument: {
        select: {
          id: true,
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

  const document = template?.designDocument;

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

export async function previewCertificateTemplate(input: PreviewCertificateTemplateInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to preview certificate templates.");
  }

  const db = getDb();
  const template = await db.certificateTemplate.findFirst({
    where: {
      id: input.templateId,
      recordTier: "HOT",
      designDocumentId: {
        not: null,
      },
    },
    select: {
      name: true,
      version: true,
      workspaceId: true,
      placementMetadata: true,
      designDocument: {
        select: {
          storageProvider: true,
          bucket: true,
          objectKey: true,
          mimeType: true,
          access: true,
          isActive: true,
          recordTier: true,
          revokedAt: true,
        },
      },
    },
  });

  const designDocument = template?.designDocument;

  if (
    !template ||
    !designDocument ||
    !designDocument.isActive ||
    designDocument.recordTier !== "HOT" ||
    designDocument.revokedAt ||
    designDocument.access !== "PRIVATE"
  ) {
    return null;
  }

  const placementMetadata = requirePlacementMetadata(template.placementMetadata);
  const downloadedDesign = await downloadObject({
    storageProvider: designDocument.storageProvider,
    bucket: designDocument.bucket,
    objectKey: designDocument.objectKey,
  });
  const signatures = await getOptionalSignatureImages(template.workspaceId);
  const qrCode = await renderQrPng(getVerificationUrl("CERT-2026-0001"));
  const buffer = await renderCertificatePdf({
    designBuffer: downloadedDesign.buffer,
    designMimeType: designDocument.mimeType,
    placementMetadata,
    signatures,
    qrCode,
    values: {
      companyName: "ABC MANUFACTURING LIMITED",
      itfEmployerNumber: "ITF-XXX-12345",
      certificateNumber: "CERT-2026-0001",
      issuedAt: "26 May 2026",
    },
  });

  return {
    buffer,
    fileName: sanitizeFileName(`${template.name}-v${template.version}-preview.pdf`),
    fileSize: buffer.byteLength,
    mimeType: "application/pdf",
  };
}

export async function generateRegistrationCertificatePdf(
  input: GenerateRegistrationCertificatePdfInput,
) {
  if (!can(input.requesterRole, "workspace:manage") && !can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to generate registration certificates.");
  }

  const db = getDb();
  const certificate = await db.registrationCertificate.findFirst({
    where: {
      id: input.certificateId,
      recordTier: "HOT",
      status: "ACTIVE",
    },
    select: {
      id: true,
      companyId: true,
      registrationApplicationId: true,
      certificateNumber: true,
      itfEmployerNumber: true,
      issuedAt: true,
      generatedDocumentId: true,
      company: {
        select: {
          id: true,
          legalName: true,
          organizationId: true,
        },
      },
      template: {
        select: {
          id: true,
          workspaceId: true,
          designDocumentId: true,
          placementMetadata: true,
          designDocument: {
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
      },
    },
  });

  if (!certificate) {
    throw new Error("Active registration certificate was not found.");
  }

  const template = certificate.template;

  if (!template) {
    throw new Error("Certificate template is required before PDF generation.");
  }

  const designDocument = template.designDocument;

  if (
    !template.designDocumentId ||
    !designDocument ||
    !designDocument.isActive ||
    designDocument.recordTier !== "HOT" ||
    designDocument.revokedAt ||
    designDocument.access !== "PRIVATE"
  ) {
    throw new Error("Active certificate template design is required before PDF generation.");
  }

  const placementMetadata = requirePlacementMetadata(template.placementMetadata);
  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
    },
  });

  if (!requester) {
    throw new Error("Generator user was not found.");
  }

  const downloadedDesign = await downloadObject({
    storageProvider: designDocument.storageProvider,
    bucket: designDocument.bucket,
    objectKey: designDocument.objectKey,
  });
  const signatures = await getRequiredSignatureImages(template.workspaceId);
  const qrCode = await renderQrPng(getVerificationUrl(certificate.certificateNumber));
  const generatedBuffer = await renderCertificatePdf({
    designBuffer: downloadedDesign.buffer,
    designMimeType: designDocument.mimeType,
    placementMetadata,
    signatures,
    qrCode,
    values: {
      companyName: certificate.company.legalName,
      itfEmployerNumber: certificate.itfEmployerNumber,
      certificateNumber: certificate.certificateNumber,
      issuedAt: formatCertificateDate(certificate.issuedAt),
    },
  });
  const fileName = sanitizeFileName(`${certificate.certificateNumber}-certificate.pdf`);
  const stored = await uploadObject({
    buffer: generatedBuffer,
    companyId: certificate.companyId,
    extension: ".pdf",
    mimeType: "application/pdf",
    namespace: "registration-certificates",
  });
  const generatedAt = new Date();

  return db.$transaction(async (tx) => {
    if (certificate.generatedDocumentId) {
      await tx.document.updateMany({
        where: {
          id: certificate.generatedDocumentId,
        },
        data: {
          isActive: false,
          revokedAt: generatedAt,
        },
      });
    }

    const document = await tx.document.create({
      data: {
        organizationId: certificate.company.organizationId,
        companyId: certificate.companyId,
        registrationApplicationId: certificate.registrationApplicationId,
        uploadedById: requester.id,
        kind: "CERTIFICATE",
        fileName,
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

    return tx.registrationCertificate.update({
      where: {
        id: certificate.id,
      },
      data: {
        generatedDocumentId: document.id,
        generatedAt,
      },
      select: {
        id: true,
        generatedDocumentId: true,
        generatedAt: true,
      },
    });
  });
}

export async function generateComplianceCertificatePdf(
  input: GenerateComplianceCertificatePdfInput,
) {
  if (!canManageAnnualCompliance(input.requesterRole)) {
    throw new Error("You do not have permission to generate compliance certificates.");
  }

  const db = getDb();
  const certificate = await db.complianceCertificate.findFirst({
    where: {
      id: input.certificateId,
      recordTier: "HOT",
      status: "ACTIVE",
    },
    select: {
      id: true,
      companyId: true,
      complianceYearId: true,
      certificateNumber: true,
      itfEmployerNumber: true,
      issuedAt: true,
      generatedDocumentId: true,
      company: {
        select: {
          id: true,
          legalName: true,
          organizationId: true,
        },
      },
      template: {
        select: {
          id: true,
          workspaceId: true,
          designDocumentId: true,
          placementMetadata: true,
          designDocument: {
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
      },
    },
  });

  if (!certificate) {
    throw new Error("Active compliance certificate was not found.");
  }

  const template = certificate.template;

  if (!template) {
    throw new Error("Certificate template is required before PDF generation.");
  }

  const designDocument = template.designDocument;

  if (
    !template.designDocumentId ||
    !designDocument ||
    !designDocument.isActive ||
    designDocument.recordTier !== "HOT" ||
    designDocument.revokedAt ||
    designDocument.access !== "PRIVATE"
  ) {
    throw new Error("Active certificate template design is required before PDF generation.");
  }

  const placementMetadata = requirePlacementMetadata(template.placementMetadata);
  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
    },
  });

  if (!requester) {
    throw new Error("Generator user was not found.");
  }

  const downloadedDesign = await downloadObject({
    storageProvider: designDocument.storageProvider,
    bucket: designDocument.bucket,
    objectKey: designDocument.objectKey,
  });
  const signatures = await getRequiredSignatureImages(template.workspaceId);
  const qrCode = await renderQrPng(getVerificationUrl(certificate.certificateNumber));
  const generatedBuffer = await renderCertificatePdf({
    designBuffer: downloadedDesign.buffer,
    designMimeType: designDocument.mimeType,
    placementMetadata,
    signatures,
    qrCode,
    values: {
      companyName: certificate.company.legalName,
      itfEmployerNumber: certificate.itfEmployerNumber,
      certificateNumber: certificate.certificateNumber,
      issuedAt: formatCertificateDate(certificate.issuedAt),
    },
  });
  const fileName = sanitizeFileName(`${certificate.certificateNumber}-compliance-certificate.pdf`);
  const stored = await uploadObject({
    buffer: generatedBuffer,
    companyId: certificate.companyId,
    extension: ".pdf",
    mimeType: "application/pdf",
    namespace: "compliance-certificates",
  });
  const generatedAt = new Date();

  return db.$transaction(async (tx) => {
    if (certificate.generatedDocumentId) {
      await tx.document.updateMany({
        where: {
          id: certificate.generatedDocumentId,
        },
        data: {
          isActive: false,
          revokedAt: generatedAt,
        },
      });
    }

    const document = await tx.document.create({
      data: {
        organizationId: certificate.company.organizationId,
        companyId: certificate.companyId,
        complianceYearId: certificate.complianceYearId,
        uploadedById: requester.id,
        kind: "CERTIFICATE",
        fileName,
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

    return tx.complianceCertificate.update({
      where: {
        id: certificate.id,
      },
      data: {
        generatedDocumentId: document.id,
        generatedAt,
      },
      select: {
        id: true,
        generatedDocumentId: true,
        generatedAt: true,
      },
    });
  });
}

export async function downloadRegistrationCertificate(
  input: DownloadRegistrationCertificateInput,
) {
  if (!can(input.requesterRole, "company:read")) {
    throw new Error("You do not have permission to read registration certificates.");
  }

  const db = getDb();
  const certificate = await db.registrationCertificate.findFirst({
    where: {
      id: input.certificateId,
      companyId: input.companyId,
      recordTier: "HOT",
      generatedDocumentId: {
        not: null,
      },
    },
    select: {
      generatedDocumentId: true,
    },
  });

  if (!certificate?.generatedDocumentId) {
    return null;
  }

  const document = await db.document.findFirst({
    where: {
      id: certificate.generatedDocumentId,
      companyId: input.companyId,
      kind: "CERTIFICATE",
      isActive: true,
      recordTier: "HOT",
      revokedAt: null,
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
    throw new Error("Unsupported certificate document access policy.");
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
    throw new Error("You do not have access to this registration certificate.");
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

export async function downloadComplianceCertificate(input: DownloadComplianceCertificateInput) {
  if (!can(input.requesterRole, "company:read")) {
    throw new Error("You do not have permission to read compliance certificates.");
  }

  const db = getDb();
  const certificate = await db.complianceCertificate.findFirst({
    where: {
      id: input.certificateId,
      companyId: input.companyId,
      complianceYearId: input.complianceYearId,
      recordTier: "HOT",
      generatedDocumentId: {
        not: null,
      },
    },
    select: {
      generatedDocumentId: true,
    },
  });

  if (!certificate?.generatedDocumentId) {
    return null;
  }

  const document = await db.document.findFirst({
    where: {
      id: certificate.generatedDocumentId,
      companyId: input.companyId,
      complianceYearId: input.complianceYearId,
      kind: "CERTIFICATE",
      isActive: true,
      recordTier: "HOT",
      revokedAt: null,
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
    throw new Error("Unsupported certificate document access policy.");
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
    throw new Error("You do not have access to this compliance certificate.");
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

function normalizeTemplateCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getMissingPlacementKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [...requiredPlacementKeys, ...requiredSignaturePlacementKeys, ...requiredQrPlacementKeys];
  }

  return [...requiredPlacementKeys, ...requiredSignaturePlacementKeys, ...requiredQrPlacementKeys].filter(
    (key) => !Object.hasOwn(value, key),
  );
}

function requirePlacementMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Certificate placement metadata is required before PDF generation.");
  }

  const metadata = value as CertificatePlacementMetadata;
  assertPlacementMetadata(metadata);

  return metadata;
}

function assertPlacementMetadata(value: CertificatePlacementMetadata) {
  for (const key of requiredPlacementKeys) {
    const point = value[key];

    if (!point) {
      throw new Error(`${key} placement is required.`);
    }

    for (const property of ["x", "y", "fontSize"] as const) {
      if (!Number.isFinite(point[property]) || point[property] < 0) {
        throw new Error(`${key}.${property} must be a non-negative number.`);
      }
    }

    if (point.fontSize === 0) {
      throw new Error(`${key}.fontSize must be greater than zero.`);
    }
  }

  for (const key of requiredSignaturePlacementKeys) {
    const point = value[key];

    if (!point) {
      throw new Error(`${key} placement is required.`);
    }

    for (const property of ["x", "y", "width", "height"] as const) {
      if (!Number.isFinite(point[property]) || point[property] < 0) {
        throw new Error(`${key}.${property} must be a non-negative number.`);
      }
    }

    if (point.width === 0 || point.height === 0) {
      throw new Error(`${key}.width and ${key}.height must be greater than zero.`);
    }
  }

  for (const key of requiredQrPlacementKeys) {
    const point = value[key];

    if (!point) {
      throw new Error(`${key} placement is required.`);
    }

    for (const property of ["x", "y", "width", "height"] as const) {
      if (!Number.isFinite(point[property]) || point[property] < 0) {
        throw new Error(`${key}.${property} must be a non-negative number.`);
      }
    }

    if (point.width === 0 || point.height === 0) {
      throw new Error(`${key}.width and ${key}.height must be greater than zero.`);
    }
  }
}

async function renderCertificatePdf(input: {
  designBuffer: Buffer;
  designMimeType: string;
  placementMetadata: CertificatePlacementMetadata;
  signatures?: Partial<Record<(typeof requiredSignatureAssets)[number], SignatureImage>>;
  qrCode?: Buffer;
  values: Record<(typeof requiredPlacementKeys)[number], string>;
}) {
  const pdfDocument = await createPdfFromTemplate(input.designBuffer, input.designMimeType);
  const [page] = pdfDocument.getPages();
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  for (const key of requiredPlacementKeys) {
    const point = input.placementMetadata[key];

    page.drawText(input.values[key], {
      x: point.x,
      y: point.y,
      size: point.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  await drawCertificateSignatures({
    pdfDocument,
    page,
    placementMetadata: input.placementMetadata,
    signatures: input.signatures,
  });
  await drawQrCode({
    pdfDocument,
    page,
    qrCode: input.qrCode,
    placement: input.placementMetadata.qrCode,
  });

  return Buffer.from(await pdfDocument.save());
}

async function createPdfFromTemplate(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") {
    return PDFDocument.load(buffer);
  }

  const pdfDocument = await PDFDocument.create();

  if (mimeType === "image/png") {
    const image = await pdfDocument.embedPng(buffer);
    const page = pdfDocument.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    return pdfDocument;
  }

  if (mimeType === "image/jpeg") {
    const image = await pdfDocument.embedJpg(buffer);
    const page = pdfDocument.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    return pdfDocument;
  }

  throw new Error("Certificate templates must be PDF, PNG, or JPEG files.");
}

type SignatureImage = {
  buffer: Buffer;
  mimeType: string;
};

async function getOptionalSignatureImages(workspaceId: string) {
  const db = getDb();
  const signatureAssets = await db.signatureAsset.findMany({
    where: {
      workspaceId,
      kind: {
        in: [...requiredSignatureAssets],
      },
      isActive: true,
      recordTier: "HOT",
      document: {
        isActive: true,
        recordTier: "HOT",
        revokedAt: null,
        access: "PRIVATE",
      },
    },
    select: {
      kind: true,
      document: {
        select: {
          storageProvider: true,
          bucket: true,
          objectKey: true,
          mimeType: true,
        },
      },
    },
  });

  const signatures: Partial<Record<(typeof requiredSignatureAssets)[number], SignatureImage>> = {};

  for (const signatureAsset of signatureAssets) {
    const downloaded = await downloadObject({
      storageProvider: signatureAsset.document.storageProvider,
      bucket: signatureAsset.document.bucket,
      objectKey: signatureAsset.document.objectKey,
    });

    signatures[signatureAsset.kind] = {
      buffer: downloaded.buffer,
      mimeType: signatureAsset.document.mimeType,
    };
  }

  return signatures;
}

async function getRequiredSignatureImages(workspaceId: string) {
  const signatures = await getOptionalSignatureImages(workspaceId);
  const missing = requiredSignatureAssets.filter((kind) => !signatures[kind]);

  if (missing.length > 0) {
    throw new Error(`Active certificate signature assets are required: ${missing.join(", ")}.`);
  }

  return signatures;
}

async function getMissingSignatureAssets(workspaceId: string) {
  const db = getDb();
  const signatureAssets = await db.signatureAsset.findMany({
    where: {
      workspaceId,
      kind: {
        in: [...requiredSignatureAssets],
      },
      isActive: true,
      recordTier: "HOT",
      document: {
        isActive: true,
        recordTier: "HOT",
        revokedAt: null,
        access: "PRIVATE",
      },
    },
    select: {
      kind: true,
    },
  });
  const availableKinds = new Set(signatureAssets.map((asset) => asset.kind));

  return requiredSignatureAssets.filter((kind) => !availableKinds.has(kind));
}

async function drawCertificateSignatures(input: {
  pdfDocument: PDFDocument;
  page: ReturnType<PDFDocument["getPages"]>[number];
  placementMetadata: CertificatePlacementMetadata;
  signatures?: Partial<Record<(typeof requiredSignatureAssets)[number], SignatureImage>>;
}) {
  await drawSignatureImage({
    pdfDocument: input.pdfDocument,
    page: input.page,
    signature: input.signatures?.DIRECTOR_GENERAL_CE,
    placement: input.placementMetadata.directorGeneralSignature,
  });
  await drawSignatureImage({
    pdfDocument: input.pdfDocument,
    page: input.page,
    signature: input.signatures?.DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE,
    placement: input.placementMetadata.directorRevenueSignature,
  });
}

async function drawSignatureImage(input: {
  pdfDocument: PDFDocument;
  page: ReturnType<PDFDocument["getPages"]>[number];
  signature?: SignatureImage;
  placement: CertificateSignaturePlacementPoint;
}) {
  if (!input.signature) {
    return;
  }

  const image =
    input.signature.mimeType === "image/png"
      ? await input.pdfDocument.embedPng(input.signature.buffer)
      : await input.pdfDocument.embedJpg(input.signature.buffer);

  input.page.drawImage(image, {
    x: input.placement.x,
    y: input.placement.y,
    width: input.placement.width,
    height: input.placement.height,
  });
}

async function drawQrCode(input: {
  pdfDocument: PDFDocument;
  page: ReturnType<PDFDocument["getPages"]>[number];
  qrCode?: Buffer;
  placement: CertificateSignaturePlacementPoint;
}) {
  if (!input.qrCode) {
    return;
  }

  const image = await input.pdfDocument.embedPng(input.qrCode);

  input.page.drawImage(image, {
    x: input.placement.x,
    y: input.placement.y,
    width: input.placement.width,
    height: input.placement.height,
  });
}

function formatCertificateDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}
