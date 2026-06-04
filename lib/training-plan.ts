import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { maxUploadBytes, sanitizeFileName, validateUpload } from "@/lib/storage/security";

const trainingPlanEvidenceKinds = ["TRAINING_PLAN_DOCUMENT", "LD_PERSONNEL_CV"] as const;
const requiredTrainingPlanCsvColumns = [
  "name of staff",
  "department",
  "gap identified",
  "training title",
  "estimated cost",
  "date",
  "location",
  "trainer",
] as const;

export type TrainingPlanEvidenceKind = (typeof trainingPlanEvidenceKinds)[number];

export type TrainingPlanPersonnelInput = {
  name: string;
  position?: string;
  email?: string;
  phone?: string;
};

export type CreateTrainingPlanSubmissionInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  year: number;
  personnel: TrainingPlanPersonnelInput[];
  trainingPlanSummary?: string;
};

export type SubmitTrainingPlanSubmissionInput = {
  companyId: string;
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  note?: string;
};

const trainingPlanDeskTransitions = [
  "am_to_hot",
  "hot_to_ro",
  "ro_to_hot",
  "hot_to_am",
  "am_to_company",
  "hot_to_company",
  "ro_to_company",
  "am_approve",
] as const;

export type TrainingPlanDeskTransition = (typeof trainingPlanDeskTransitions)[number];

export type RouteTrainingPlanSubmissionInput = {
  companyId: string;
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  transition: TrainingPlanDeskTransition;
  note?: string;
};

export type UploadTrainingPlanEvidenceInput = {
  companyId: string;
  submissionId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: TrainingPlanEvidenceKind;
  file: File;
};

export type ImportTrainingPlanCsvInput = {
  companyId: string;
  submissionId: string;
  requesterEmail: string;
  requesterRole: Role;
  file: File;
};

export function getTrainingPlanEvidenceKinds() {
  return trainingPlanEvidenceKinds;
}

export function getTrainingPlanCsvTemplate() {
  return `${requiredTrainingPlanCsvColumns.join(",")}\n`;
}

export function getTrainingPlanDeskTransitions() {
  return trainingPlanDeskTransitions;
}

function parseTrainingPlanCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one training plan row.");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const missingColumns = requiredTrainingPlanCsvColumns.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`Missing required CSV column(s): ${missingColumns.join(", ")}.`);
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line).map((value) => value.trim());

    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} columns instead of ${headers.length}.`);
    }

    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex]]));
    const estimatedCost = Number(row["estimated cost"]);
    const plannedDate = row.date ? new Date(row.date) : null;

    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw new Error(`CSV row ${index + 2} has an invalid estimated cost.`);
    }

    if (plannedDate && Number.isNaN(plannedDate.getTime())) {
      throw new Error(`CSV row ${index + 2} has an invalid date.`);
    }

    return {
      staffName: row["name of staff"],
      department: row.department,
      gapIdentified: row["gap identified"],
      trainingTitle: row["training title"],
      estimatedCost,
      plannedDate,
      location: row.location,
      trainer: row.trainer,
      rowNumber: index + 2,
    };
  });
}

export async function createTrainingPlanSubmission(input: CreateTrainingPlanSubmissionInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to create training plan submissions.");
  }

  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
      isActive: true,
      status: "ACTIVE",
      itfEmployerNumber: {
        not: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
      complianceYears: {
        where: {
          year: input.year,
          status: "APPROVED",
          certificate: {
            isNot: null,
          },
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!company) {
    throw new Error("A registered active company is required before training plan submission.");
  }

  if (company.complianceYears.length === 0) {
    throw new Error(
      `Approved ${input.year} compliance with an issued certificate is required before Training Plan and L&D submission.`,
    );
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
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

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some((membership) => membership.organizationId === company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this company's training plan submissions.");
  }

  const existingSubmission = await db.trainingPlanSubmission.findUnique({
    where: {
      companyId_year: {
        companyId: company.id,
        year: input.year,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingSubmission) {
    throw new Error(
      `A Training Plan and L&D submission already exists for ${input.year}. Open the existing submission instead of creating another one for the same year.`,
    );
  }

  return db.trainingPlanSubmission.create({
    data: {
      companyId: company.id,
      year: input.year,
      trainingPlanSummary: input.trainingPlanSummary,
      dueDate: getTrainingPlanDueDate(input.year),
      status: "DRAFT",
      personnel: {
        create: input.personnel.map((person) => ({
          name: person.name,
          position: person.position,
          email: person.email,
          phone: person.phone,
        })),
      },
    },
    select: {
      id: true,
    },
  });
}

export async function importTrainingPlanCsv(input: ImportTrainingPlanCsvInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to import training plan rows.");
  }

  if (!input.file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Upload a CSV file.");
  }

  const rows = parseTrainingPlanCsv(await input.file.text());
  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "CHANGES_REQUESTED"],
      },
      company: {
        id: input.companyId,
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

  if (!submission) {
    throw new Error("Training Plan submission was not found or is no longer editable.");
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
      (membership) => membership.organizationId === submission.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this Training Plan submission.");
  }

  return db.$transaction(async (tx) => {
    await tx.trainingPlanLineItem.deleteMany({
      where: {
        trainingPlanSubmissionId: submission.id,
      },
    });

    await tx.trainingPlanLineItem.createMany({
      data: rows.map((row) => ({
        trainingPlanSubmissionId: submission.id,
        staffName: row.staffName,
        department: row.department,
        gapIdentified: row.gapIdentified,
        trainingTitle: row.trainingTitle,
        estimatedCost: row.estimatedCost,
        plannedDate: row.plannedDate,
        location: row.location,
        trainer: row.trainer,
        rowNumber: row.rowNumber,
      })),
    });

    return {
      importedRows: rows.length,
    };
  });
}

export async function getTrainingPlanSubmissionForUpload(companyId: string, submissionId: string) {
  const db = getDb();

  return db.trainingPlanSubmission.findFirst({
    where: {
      id: submissionId,
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

export async function uploadTrainingPlanEvidence(input: UploadTrainingPlanEvidenceInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to upload training plan evidence.");
  }

  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
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
      year: true,
      companyId: true,
      company: {
        select: {
          organizationId: true,
          complianceYears: {
            where: {
              status: "APPROVED",
              certificate: {
                isNot: null,
              },
            },
            select: {
              id: true,
              year: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Training plan submission was not found.");
  }

  const hasCertifiedComplianceYear = submission.company.complianceYears.some(
    (complianceYear) => complianceYear.year === submission.year,
  );

  if (!hasCertifiedComplianceYear) {
    throw new Error(
      `Approved ${submission.year} compliance with an issued certificate is required before uploading Training Plan evidence.`,
    );
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
    user.memberships.some((membership) => membership.organizationId === submission.company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this training plan submission.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated =
    input.kind === "TRAINING_PLAN_DOCUMENT"
      ? validateTrainingPlanCsvUpload(buffer, safeFileName, input.file.type)
      : validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: submission.companyId,
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "training-plan-submissions",
  });

  return db.document.create({
    data: {
      organizationId: submission.company.organizationId,
      companyId: submission.companyId,
      trainingPlanSubmissionId: submission.id,
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

export async function submitTrainingPlanSubmission(input: SubmitTrainingPlanSubmissionInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to submit training plans.");
  }

  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "CHANGES_REQUESTED"],
      },
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      companyId: true,
      dueDate: true,
      documents: {
        where: {
          isActive: true,
          recordTier: "HOT",
        },
        select: {
          kind: true,
        },
      },
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
          complianceYears: {
            where: {
              status: "APPROVED",
              certificate: {
                isNot: null,
              },
            },
            select: {
              id: true,
              year: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Draft training plan submission was not found.");
  }

  const hasCertifiedComplianceYear = submission.company.complianceYears.some(
    (complianceYear) => complianceYear.year === submission.year,
  );

  if (!hasCertifiedComplianceYear) {
    throw new Error(
      `Approved ${submission.year} compliance with an issued certificate is required before Training Plan and L&D submission.`,
    );
  }

  const submittedKinds = new Set(submission.documents.map((document) => document.kind));
  const missingKinds = trainingPlanEvidenceKinds.filter((kind) => !submittedKinds.has(kind));

  if (missingKinds.length > 0) {
    throw new Error(`Upload required evidence before submission: ${missingKinds.join(", ")}.`);
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
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
    actor.memberships.some((membership) => membership.organizationId === submission.company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this training plan submission.");
  }

  const submittedAt = new Date();
  const promptSubmissionScore = submittedAt <= submission.dueDate ? "1.00" : "0.00";

  return db.$transaction(async (tx) => {
    const updated = await tx.trainingPlanSubmission.update({
      where: {
        id: submission.id,
      },
      data: {
        status: "SUBMITTED",
        currentDesk: "AREA_MANAGER",
        submittedAt,
        promptSubmissionScore,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        action: "SUBMIT",
        reason: input.note,
      },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: `training-plan:${submission.id}:area-manager-review`,
      },
      create: {
        workspaceId: submission.company.organization.workspaceId,
        organizationId: submission.company.organizationId,
        areaOfficeId: submission.company.areaOfficeId,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        assignedRole: "AREA_MANAGER",
        app: "REIMBURSEMENT",
        kind: "TRAINING_PLAN_REVIEW",
        status: "OPEN",
        priority: "NORMAL",
        title: "Review Training Plan and L&D submission",
        summary: `${submission.company.legalName} submitted the ${submission.year} Training Plan and L&D package.`,
        targetHref: `/registry/${submission.companyId}`,
        sourceKey: `training-plan:${submission.id}:area-manager-review`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "NORMAL",
        summary: `${submission.company.legalName} submitted the ${submission.year} Training Plan and L&D package.`,
        targetHref: `/registry/${submission.companyId}`,
      },
      select: {
        id: true,
      },
    });

    return updated;
  });
}

export async function routeTrainingPlanSubmission(input: RouteTrainingPlanSubmissionInput) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to route training plan submissions.");
  }

  const transition = resolveTrainingPlanTransition(input.transition);

  if (!hasTrainingPlanRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error(`Only ${transition.allowedRoles.join(" or ")} can perform this action.`);
  }

  const db = getDb();
  const submission = await db.trainingPlanSubmission.findFirst({
    where: {
      id: input.submissionId,
      companyId: input.companyId,
      recordTier: "HOT",
      status: {
        in: [...transition.allowedStatuses],
      },
      currentDesk: transition.from,
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      year: true,
      companyId: true,
      currentDesk: true,
      status: true,
      company: {
        select: {
          legalName: true,
          organizationId: true,
          areaOfficeId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("A training plan submission awaiting this action was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
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

  if (
    !hasAreaOfficeTrainingPlanAccess({
      requesterRole: input.requesterRole,
      areaOfficeId: submission.company.areaOfficeId,
      memberships: actor.memberships,
    })
  ) {
    throw new Error("You do not have access to this Area Office training plan submission.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.trainingPlanSubmission.update({
      where: {
        id: submission.id,
      },
      data: {
        currentDesk: transition.to,
        status: transition.nextStatus,
        approvedAt: transition.nextStatus === "APPROVED" ? new Date() : undefined,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: submission.companyId,
        trainingPlanSubmissionId: submission.id,
        action: transition.action,
        reason: [transition.reason, input.note].filter(Boolean).join(": "),
      },
    });

    await tx.workItem.updateMany({
      where: {
        trainingPlanSubmissionId: submission.id,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    if (transition.assignedRole) {
      await tx.workItem.upsert({
        where: {
          sourceKey: `training-plan:${submission.id}:${transition.to.toLowerCase()}`,
        },
        create: {
          workspaceId: submission.company.organization.workspaceId,
          organizationId: submission.company.organizationId,
          areaOfficeId: submission.company.areaOfficeId,
          companyId: submission.companyId,
          trainingPlanSubmissionId: submission.id,
          assignedRole: transition.assignedRole,
          app: "REIMBURSEMENT",
          kind: "TRAINING_PLAN_REVIEW",
          status: "OPEN",
          priority: transition.priority,
          title: transition.workItemTitle,
          summary: `${submission.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/registry/${submission.companyId}`,
          sourceKey: `training-plan:${submission.id}:${transition.to.toLowerCase()}`,
        },
        update: {
          status: "OPEN",
          resolvedAt: null,
          priority: transition.priority,
          summary: `${submission.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/registry/${submission.companyId}`,
        },
        select: {
          id: true,
        },
      });
    }

    return updated;
  });
}

function resolveTrainingPlanTransition(transition: TrainingPlanDeskTransition) {
  const transitions = {
    am_to_hot: {
      from: "AREA_MANAGER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "HEAD_OF_TRAINING",
      action: "FORWARD",
      reason: "AM forwarded Training Plan and L&D submission to Head of Training",
      workItemTitle: "Review Training Plan and L&D submission",
      workItemSummary: "is awaiting Head of Training review.",
      priority: "NORMAL",
    },
    hot_to_ro: {
      from: "HEAD_OF_TRAINING",
      to: "REIMBURSEMENT_OFFICER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "REIMBURSEMENT_OFFICER",
      action: "FORWARD",
      reason: "HOT forwarded Training Plan and L&D submission to Reimbursement Officer",
      workItemTitle: "Review Training Plan and L&D evidence",
      workItemSummary: "is awaiting Reimbursement Officer review.",
      priority: "NORMAL",
    },
    ro_to_hot: {
      from: "REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "HEAD_OF_TRAINING",
      action: "RECOMMEND",
      reason: "Reimbursement Officer returned Training Plan and L&D submission to HOT",
      workItemTitle: "Confirm Training Plan and L&D recommendation",
      workItemSummary: "has been reviewed by the Reimbursement Officer.",
      priority: "NORMAL",
    },
    hot_to_am: {
      from: "HEAD_OF_TRAINING",
      to: "AREA_MANAGER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      assignedRole: "AREA_MANAGER",
      action: "FORWARD",
      reason: "HOT returned Training Plan and L&D submission to AM",
      workItemTitle: "Finalize Area Office Training Plan review",
      workItemSummary: "is awaiting Area Manager final Area Office action.",
      priority: "NORMAL",
    },
    am_to_company: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      assignedRole: null,
      action: "REQUEST_CHANGES",
      reason: "AM requested correction on Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "HIGH",
    },
    hot_to_company: {
      from: "HEAD_OF_TRAINING",
      to: "COMPANY",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      assignedRole: null,
      action: "REQUEST_CHANGES",
      reason: "HOT requested correction on Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "HIGH",
    },
    ro_to_company: {
      from: "REIMBURSEMENT_OFFICER",
      to: "COMPANY",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      assignedRole: null,
      action: "REQUEST_CHANGES",
      reason: "Reimbursement Officer requested correction on Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "HIGH",
    },
    am_approve: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "APPROVED",
      assignedRole: null,
      action: "APPROVE",
      reason: "AM approved Training Plan and L&D submission",
      workItemTitle: "",
      workItemSummary: "",
      priority: "NORMAL",
    },
  } as const;

  return transitions[transition];
}

function hasTrainingPlanRoutingRole(requesterRole: Role, allowedRoles: readonly Role[]) {
  return (
    requesterRole === "SYSTEM_ADMIN" ||
    requesterRole === "WORKSPACE_APP_ADMIN" ||
    allowedRoles.includes(requesterRole)
  );
}

function hasAreaOfficeTrainingPlanAccess(input: {
  requesterRole: Role;
  areaOfficeId: string | null;
  memberships: { areaOfficeId: string | null }[];
}) {
  if (input.requesterRole === "SYSTEM_ADMIN" || input.requesterRole === "WORKSPACE_APP_ADMIN") {
    return true;
  }

  if (!input.areaOfficeId) {
    return false;
  }

  return input.memberships.some((membership) => membership.areaOfficeId === input.areaOfficeId);
}

function getTrainingPlanDueDate(year: number) {
  return new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));
}

function validateTrainingPlanCsvUpload(buffer: Buffer, fileName: string, mimeType: string) {
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded CSV file is empty.");
  }

  if (buffer.byteLength > maxUploadBytes) {
    throw new Error("Uploaded CSV file exceeds the 10 MB limit.");
  }

  if (!fileName.toLowerCase().endsWith(".csv")) {
    throw new Error("Training plan document must be a CSV file.");
  }

  const acceptedMimeTypes = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ]);

  if (mimeType && !acceptedMimeTypes.has(mimeType)) {
    throw new Error("Training plan document must be uploaded as a CSV file.");
  }

  const content = buffer.toString("utf8").replace(/^\uFEFF/, "");

  if (content.includes("\uFFFD")) {
    throw new Error("Training plan CSV must be valid UTF-8 text.");
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Training plan CSV must include a header row and at least one training row.");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const missingColumns = requiredTrainingPlanCsvColumns.filter(
    (column) => !headers.includes(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(`Training plan CSV is missing columns: ${missingColumns.join(", ")}.`);
  }

  return {
    extension: ".csv",
    mimeType: "text/csv",
  };
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);

  return values;
}
