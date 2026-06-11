import { getDb } from "@/lib/db";
import { normalizeEvidenceDocumentName } from "@/lib/evidence-metadata";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  findActiveCertificateTemplate,
  generateComplianceCertificatePdf,
} from "@/lib/certificates";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { can, canManageAnnualCompliance, isItfRole, type Role } from "@/lib/rbac";
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

const complianceTransitions = [
  "submit",
  "start_review",
  "approve",
  "request_changes",
  "reject",
] as const;

export type ComplianceTransition = (typeof complianceTransitions)[number];

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
  documentName?: string;
  file: File;
};

export type UpdateComplianceYearStatusInput = {
  companyId: string;
  complianceYearId: string;
  requesterEmail: string;
  requesterRole: Role;
  transition: ComplianceTransition;
  reason?: string;
};

export type IssueComplianceCertificateInput = {
  companyId: string;
  complianceYearId: string;
  requesterEmail: string;
  requesterRole: Role;
  certificateNumberId: string;
  note?: string;
};

export function getComplianceEvidenceKinds() {
  return complianceEvidenceKinds;
}

export function getComplianceTransitions() {
  return complianceTransitions;
}

const complianceAwarenessRoles = ["AREA_MANAGER", "HORIC", "REVENUE_ACCOUNTANT"] as const;
const complianceReviewRoles = ["HEAD_OF_DIVISION", "HQ_REVENUE_ACCOUNTANT"] as const;

type ComplianceWorkItemContext = {
  workspaceId: string;
  organizationId: string;
  areaOfficeId: string | null;
  companyId: string;
  complianceYearId: string;
  companyName: string;
  year: number;
};

async function createComplianceSubmissionWorkItems(
  tx: Prisma.TransactionClient,
  context: ComplianceWorkItemContext,
) {
  const awarenessItems = context.areaOfficeId
    ? complianceAwarenessRoles.map((role) =>
        tx.workItem.upsert({
          where: {
            sourceKey: `compliance:${context.complianceYearId}:awareness:${role}`,
          },
          create: {
            workspaceId: context.workspaceId,
            organizationId: context.organizationId,
            areaOfficeId: context.areaOfficeId,
            companyId: context.companyId,
            complianceYearId: context.complianceYearId,
            assignedRole: role,
            app: "REIMBURSEMENT",
            kind: "COMPLIANCE_AWARENESS",
            status: "OPEN",
            priority: "NORMAL",
            title: "Compliance filed in your Area Office",
            summary: `${context.companyName} filed ${context.year} annual compliance. HQ will review and issue any certificate.`,
            targetHref: `/registry/${context.companyId}`,
            sourceKey: `compliance:${context.complianceYearId}:awareness:${role}`,
          },
          update: {
            status: "OPEN",
            resolvedAt: null,
            priority: "NORMAL",
            summary: `${context.companyName} filed ${context.year} annual compliance. HQ will review and issue any certificate.`,
            targetHref: `/registry/${context.companyId}`,
          },
          select: {
            id: true,
          },
        }),
      )
    : [];

  const reviewItems = complianceReviewRoles.map((role) =>
    tx.workItem.upsert({
      where: {
        sourceKey: `compliance:${context.complianceYearId}:review:${role}`,
      },
      create: {
        workspaceId: context.workspaceId,
        organizationId: context.organizationId,
        areaOfficeId: null,
        companyId: context.companyId,
        complianceYearId: context.complianceYearId,
        assignedRole: role,
        app: "REIMBURSEMENT",
        kind: "COMPLIANCE_REVIEW",
        status: "OPEN",
        priority: "HIGH",
        title: "Review annual compliance return",
        summary: `${context.companyName} filed ${context.year} annual compliance for HQ review.`,
        targetHref: `/registry/${context.companyId}`,
        sourceKey: `compliance:${context.complianceYearId}:review:${role}`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "HIGH",
        summary: `${context.companyName} filed ${context.year} annual compliance for HQ review.`,
        targetHref: `/registry/${context.companyId}`,
      },
      select: {
        id: true,
      },
    }),
  );

  await Promise.all([...awarenessItems, ...reviewItems]);
}

async function resolveComplianceReviewWorkItems(
  tx: Prisma.TransactionClient,
  complianceYearId: string,
  resolvedAt: Date,
) {
  await tx.workItem.updateMany({
    where: {
      complianceYearId,
      kind: {
        in: ["COMPLIANCE_AWARENESS", "COMPLIANCE_REVIEW"],
      },
      status: {
        in: ["OPEN", "ACKNOWLEDGED"],
      },
    },
    data: {
      status: "RESOLVED",
      resolvedAt,
    },
  });
}

export async function createComplianceYear(input: CreateComplianceYearInput) {
  if (input.requesterRole !== "EMPLOYER_ADMIN" && input.requesterRole !== "EMPLOYER_SUBMITTER") {
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
      itfEmployerNumber: true,
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  if (!company.itfEmployerNumber) {
    throw new Error("Company registration must be completed before annual compliance can be filed.");
  }

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

  const documentName = normalizeEvidenceDocumentName(input.kind, input.documentName);

  await assertUploadRateLimit(input.uploadedByEmail);

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
          areaOfficeId: true,
          legalName: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
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
        where: { isActive: true },
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

function resolveTransition(transition: ComplianceTransition) {
  if (transition === "submit") {
    return {
      action: "SUBMIT" as const,
      nextStatus: "SUBMITTED" as const,
      permission: "compliance:submit" as const,
      allowedStatuses: ["DRAFT", "CHANGES_REQUESTED"] as const,
    };
  }

  if (transition === "start_review") {
    return {
      action: "RECOMMEND" as const,
      nextStatus: "IN_REVIEW" as const,
      permission: "compliance:review" as const,
      allowedStatuses: ["SUBMITTED"] as const,
    };
  }

  if (transition === "approve") {
    return {
      action: "APPROVE" as const,
      nextStatus: "APPROVED" as const,
      permission: "compliance:review" as const,
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"] as const,
    };
  }

  if (transition === "request_changes") {
    return {
      action: "REQUEST_CHANGES" as const,
      nextStatus: "CHANGES_REQUESTED" as const,
      permission: "compliance:review" as const,
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"] as const,
    };
  }

  return {
    action: "REJECT" as const,
    nextStatus: "REJECTED" as const,
    permission: "compliance:review" as const,
    allowedStatuses: ["SUBMITTED", "IN_REVIEW"] as const,
  };
}

export async function updateComplianceYearStatus(input: UpdateComplianceYearStatusInput) {
  const transition = resolveTransition(input.transition);

  if (
    transition.permission === "compliance:review" &&
    !canManageAnnualCompliance(input.requesterRole)
  ) {
    throw new Error("Only Head of Division or HQ Revenue Accountant can review compliance returns.");
  }

  if (
    transition.permission !== "compliance:review" &&
    !can(input.requesterRole, transition.permission)
  ) {
    throw new Error("You do not have permission to update this compliance return.");
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
      year: true,
      status: true,
      company: {
        select: {
          organizationId: true,
          areaOfficeId: true,
          legalName: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!complianceYear) {
    throw new Error("Compliance year was not found.");
  }

  const allowedStatuses: readonly string[] = transition.allowedStatuses;

  if (!allowedStatuses.includes(complianceYear.status)) {
    throw new Error(`Cannot move compliance year from ${complianceYear.status}.`);
  }

  const actor = await db.user.findUnique({
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

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some(
      (membership) => membership.organizationId === complianceYear.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this compliance return.");
  }

  const decidedAt = new Date();

  return db.$transaction(async (tx) => {
    const updated = await tx.complianceYear.update({
      where: {
        id: complianceYear.id,
      },
      data: {
        status: transition.nextStatus,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: complianceYear.companyId,
        complianceYearId: complianceYear.id,
        action: transition.action,
        reason: input.reason,
      },
    });

    if (input.transition === "submit") {
      await createComplianceSubmissionWorkItems(tx, {
        workspaceId: complianceYear.company.organization.workspaceId,
        organizationId: complianceYear.company.organizationId,
        areaOfficeId: complianceYear.company.areaOfficeId,
        companyId: complianceYear.companyId,
        complianceYearId: complianceYear.id,
        companyName: complianceYear.company.legalName,
        year: complianceYear.year,
      });
    } else {
      await resolveComplianceReviewWorkItems(tx, complianceYear.id, decidedAt);
    }

    return updated;
  });
}

export async function issueComplianceCertificate(input: IssueComplianceCertificateInput) {
  if (!canManageAnnualCompliance(input.requesterRole)) {
    throw new Error("Only Head of Division or HQ Revenue Accountant can issue compliance certificates.");
  }

  const db = getDb();
  const complianceYear = await db.complianceYear.findFirst({
    where: {
      id: input.complianceYearId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: "APPROVED",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
        status: "ACTIVE",
        itfEmployerNumber: {
          not: null,
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      year: true,
      certificate: {
        select: {
          id: true,
        },
      },
      company: {
        select: {
          id: true,
          legalName: true,
          organizationId: true,
          itfEmployerNumber: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!complianceYear) {
    throw new Error("An approved compliance year ready for certificate issuance was not found.");
  }

  if (complianceYear.certificate) {
    throw new Error("A compliance certificate has already been issued for this year.");
  }

  const actor = await db.user.findUnique({
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

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some(
      (membership) => membership.organizationId === complianceYear.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this compliance year.");
  }

  if (!complianceYear.company.itfEmployerNumber) {
    throw new Error("ITF employer number is required before issuing a compliance certificate.");
  }

  const itfEmployerNumber = complianceYear.company.itfEmployerNumber;
  const issuedAt = new Date();
  const activeTemplate = await findActiveCertificateTemplate(
    db,
    complianceYear.company.organization.workspaceId,
    issuedAt,
  );

  const certificate = await db.$transaction(async (tx) => {
    const managedNumber = await tx.managedRegistrationNumber.findFirst({
      where: {
        id: input.certificateNumberId,
        workspaceId: complianceYear.company.organization.workspaceId,
        type: "COMPLIANCE_CERTIFICATE_NUMBER",
        status: "AVAILABLE",
        recordTier: "HOT",
      },
      select: {
        id: true,
        value: true,
      },
    });

    if (!managedNumber) {
      throw new Error("Selected compliance certificate number is no longer available.");
    }

    const certificate = await tx.complianceCertificate.create({
      data: {
        companyId: complianceYear.companyId,
        complianceYearId: complianceYear.id,
        issuedById: actor.id,
        certificateNumber: managedNumber.value,
        itfEmployerNumber,
        templateId: activeTemplate?.id,
        status: "ACTIVE",
        issuedAt,
      },
      select: {
        id: true,
      },
    });

    const assignment = await tx.managedRegistrationNumber.updateMany({
      where: {
        id: managedNumber.id,
        status: "AVAILABLE",
      },
      data: {
        status: "ASSIGNED",
        assignedCompanyId: complianceYear.companyId,
        assignedComplianceCertificateId: certificate.id,
        issuedById: actor.id,
        issuedAt,
      },
    });

    if (assignment.count !== 1) {
      throw new Error("Selected compliance certificate number could not be assigned.");
    }

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: complianceYear.companyId,
        complianceYearId: complianceYear.id,
        action: "CERTIFY",
        reason: [
          `Issued annual compliance certificate ${managedNumber.value} for ${complianceYear.year}`,
          input.note,
        ]
          .filter(Boolean)
          .join(": "),
      },
    });

    return certificate;
  });

  try {
    await generateComplianceCertificatePdf({
      certificateId: certificate.id,
      requesterEmail: input.requesterEmail,
      requesterRole: input.requesterRole,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Compliance certificate PDF generation failed.";

    await db.comment.create({
      data: {
        actorId: actor.id,
        companyId: complianceYear.companyId,
        complianceYearId: complianceYear.id,
        body: `Compliance certificate PDF generation is pending: ${message}`,
        visibility: "INTERNAL",
      },
    });
  }

  return certificate;
}
