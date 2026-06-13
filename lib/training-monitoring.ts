import { getDb } from "@/lib/db";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { can, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const trainingMonitoringEvidenceKinds = [
  "ATTENDANCE_SHEET",
  "TRAINING_REPORT",
  "TRAINING_PHOTO",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;
const trainingMonitoringTransitions = [
  "ro_submit",
  "hot_accept",
  "hot_reject",
  "hot_to_ro",
  "am_release",
  "am_to_hot",
] as const;

export type TrainingMonitoringEvidenceKind = (typeof trainingMonitoringEvidenceKinds)[number];
export type TrainingMonitoringTransition = (typeof trainingMonitoringTransitions)[number];

export type UploadTrainingMonitoringEvidenceInput = {
  recordId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: TrainingMonitoringEvidenceKind;
  file: File;
};

export type AddTrainingMonitoringEvaluationInput = {
  recordId: string;
  requesterEmail: string;
  requesterRole: Role;
  section: string;
  ratingArea: string;
  score: number;
  note?: string;
};

export type UpdateTrainingMonitoringRecordInput = {
  recordId: string;
  requesterEmail: string;
  requesterRole: Role;
  monitoringDate?: Date;
  startsAt?: Date;
  endsAt?: Date;
  meetingId?: string;
  passcode?: string;
  virtualLink?: string;
  monitoringOfficerName?: string;
  monitoringOfficerTitle?: string;
  headOfDivisionName?: string;
  directorName?: string;
};

export type RouteTrainingMonitoringRecordInput = {
  recordId: string;
  requesterEmail: string;
  requesterRole: Role;
  transition: TrainingMonitoringTransition;
  note?: string;
};

export function getTrainingMonitoringEvidenceKinds() {
  return trainingMonitoringEvidenceKinds;
}

export function getTrainingMonitoringTransitions() {
  return trainingMonitoringTransitions;
}

export async function uploadTrainingMonitoringEvidence(
  input: UploadTrainingMonitoringEvidenceInput,
) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to upload Training Monitoring evidence.");
  }

  assertMonitoringEditorRole(input.requesterRole);

  await assertUploadRateLimit(input.uploadedByEmail);

  const db = getDb();
  const record = await findEditableMonitoringRecord(input.recordId);

  const actor = await assertTrainingMonitoringAccess({
    requesterEmail: input.uploadedByEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
  });

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: record.trainingRequest.companyId,
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "training-monitoring",
  });

  return db.document.create({
    data: {
      organizationId: record.trainingRequest.company.organizationId,
      companyId: record.trainingRequest.companyId,
      trainingRequestId: record.trainingRequestId,
      trainingMonitoringRecordId: record.id,
      uploadedById: actor.id,
      kind: input.kind,
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

export async function addTrainingMonitoringEvaluation(
  input: AddTrainingMonitoringEvaluationInput,
) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to evaluate Training Monitoring records.");
  }

  assertMonitoringEditorRole(input.requesterRole);

  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    throw new Error("Evaluation score must be between 1 and 5.");
  }

  const record = await findEditableMonitoringRecord(input.recordId);

  await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
  });

  return getDb().trainingMonitoringEvaluation.create({
    data: {
      trainingMonitoringRecordId: record.id,
      section: input.section,
      ratingArea: input.ratingArea,
      score: input.score,
      note: input.note,
    },
    select: {
      id: true,
    },
  });
}

export async function updateTrainingMonitoringRecord(
  input: UpdateTrainingMonitoringRecordInput,
) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to update Training Monitoring records.");
  }

  assertMonitoringEditorRole(input.requesterRole);

  const record = await findEditableMonitoringRecord(input.recordId);

  await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
  });

  return getDb().trainingMonitoringRecord.update({
    where: {
      id: record.id,
    },
    data: {
      monitoringDate: input.monitoringDate,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      meetingId: input.meetingId,
      passcode: input.passcode,
      virtualLink: input.virtualLink,
      monitoringOfficerName: input.monitoringOfficerName,
      monitoringOfficerTitle: input.monitoringOfficerTitle,
      headOfDivisionName: input.headOfDivisionName,
      directorName: input.directorName,
    },
    select: {
      id: true,
    },
  });
}

export async function routeTrainingMonitoringRecord(
  input: RouteTrainingMonitoringRecordInput,
) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to route Training Monitoring records.");
  }

  const transition = resolveTrainingMonitoringTransition(input.transition);
  if (transition.outcome && !input.note?.trim()) {
    throw new Error("A reason is required for the Head of Training's implementation decision.");
  }

  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: input.recordId,
      recordTier: "HOT",
      status: {
        in: [...transition.from],
      },
      currentDesk: transition.fromDesk,
      trainingRequest: {
        recordTier: "HOT",
        company: {
          recordTier: "HOT",
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      trainingRequestId: true,
      decisionOutcome: true,
      trainingRequest: {
        select: {
          companyId: true,
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
      },
    },
  });

  if (!record) {
    throw new Error("Training Monitoring record was not found for this workflow action.");
  }

  const actor = await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
  });

  if (!hasMonitoringRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error(`Only ${transition.allowedRoles.join(" or ")} can perform this action.`);
  }

  return getDb().$transaction(async (tx) => {
    if (transition.requiresOutcome && !record.decisionOutcome) {
      throw new Error("The Head of Training must accept or reject the training implementation first.");
    }

    const decisionOutcome = transition.outcome ?? (transition.clearOutcome ? null : record.decisionOutcome);
    const nextStatus = transition.release
      ? decisionOutcome === "ACCEPTED"
        ? "APPROVED"
        : "REJECTED"
      : transition.toStatus;
    const now = new Date();
    const updated = await tx.trainingMonitoringRecord.update({
      where: {
        id: record.id,
      },
      data: {
        status: nextStatus,
        currentDesk: transition.toDesk,
        decisionOutcome,
        decisionReason: transition.outcome ? input.note : transition.clearOutcome ? null : undefined,
        submittedAt: transition.submitted ? now : undefined,
        decidedAt: transition.outcome ? now : undefined,
        feedbackReleasedAt: transition.release ? now : undefined,
      },
      select: {
        id: true,
      },
    });

    await tx.workItem.updateMany({
      where: {
        trainingMonitoringRecordId: record.id,
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
          sourceKey: `training-monitoring:${record.id}:${transition.toDesk.toLowerCase()}`,
        },
        create: {
          workspaceId: record.trainingRequest.company.organization.workspaceId,
          organizationId: record.trainingRequest.company.organizationId,
          areaOfficeId: record.trainingRequest.company.areaOfficeId,
          companyId: record.trainingRequest.companyId,
          trainingMonitoringRecordId: record.id,
          assignedRole: transition.assignedRole,
          app: "REIMBURSEMENT",
          kind: "TRAINING_MONITORING_REVIEW",
          status: "OPEN",
          priority: "NORMAL",
          title: transition.workItemTitle,
          summary: `${record.trainingRequest.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/training-monitoring/${record.id}`,
          sourceKey: `training-monitoring:${record.id}:${transition.toDesk.toLowerCase()}`,
        },
        update: {
          status: "OPEN",
          resolvedAt: null,
          emailNotifiedAt: null,
          assignedRole: transition.assignedRole,
          title: transition.workItemTitle,
          summary: `${record.trainingRequest.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/training-monitoring/${record.id}`,
        },
        select: {
          id: true,
        },
      });
    }

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: record.trainingRequest.companyId,
        trainingRequestId: record.trainingRequestId,
        trainingMonitoringRecordId: record.id,
        action: transition.action,
        reason: [transition.reason, input.note].filter(Boolean).join(": "),
      },
    });

    if (transition.release) {
      await tx.workItem.upsert({
        where: {
          sourceKey: `training-monitoring:${record.id}:employer-feedback`,
        },
        create: {
          workspaceId: record.trainingRequest.company.organization.workspaceId,
          organizationId: record.trainingRequest.company.organizationId,
          areaOfficeId: record.trainingRequest.company.areaOfficeId,
          companyId: record.trainingRequest.companyId,
          trainingMonitoringRecordId: record.id,
          assignedRole: "EMPLOYER_ADMIN",
          app: "REIMBURSEMENT",
          kind: "TRAINING_FEEDBACK",
          status: "OPEN",
          priority: "NORMAL",
          title: `Training implementation ${nextStatus === "APPROVED" ? "accepted" : "rejected"}`,
          summary: `Monitoring feedback and ratings are available for ${record.trainingRequest.company.legalName}.`,
          targetHref: `/training-monitoring/${record.id}`,
          sourceKey: `training-monitoring:${record.id}:employer-feedback`,
        },
        update: {
          status: "OPEN",
          resolvedAt: null,
          emailNotifiedAt: null,
          title: `Training implementation ${nextStatus === "APPROVED" ? "accepted" : "rejected"}`,
          summary: `Monitoring feedback and ratings are available for ${record.trainingRequest.company.legalName}.`,
        },
      });
    }

    return updated;
  });
}

function resolveTrainingMonitoringTransition(transition: TrainingMonitoringTransition) {
  const transitions = {
    ro_submit: {
      from: ["DRAFT", "CHANGES_REQUESTED"],
      fromDesk: "REIMBURSEMENT_OFFICER",
      toStatus: "SUBMITTED",
      toDesk: "HEAD_OF_TRAINING",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      submitted: true,
      release: false,
      assignedRole: "HEAD_OF_TRAINING",
      action: "SUBMIT",
      reason: "Reimbursement Officer submitted the monitoring report",
      workItemTitle: "Decide training implementation outcome",
      workItemSummary: "has a monitoring report awaiting Head of Training decision.",
    },
    hot_accept: {
      from: ["SUBMITTED"],
      fromDesk: "HEAD_OF_TRAINING",
      toStatus: "IN_REVIEW",
      toDesk: "AREA_MANAGER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      outcome: "ACCEPTED",
      clearOutcome: false,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "AREA_MANAGER",
      action: "APPROVE",
      reason: "Head of Training accepted the training implementation",
      workItemTitle: "Release accepted training implementation",
      workItemSummary: "was accepted by the Head of Training and awaits Area Manager release.",
    },
    hot_reject: {
      from: ["SUBMITTED"],
      fromDesk: "HEAD_OF_TRAINING",
      toStatus: "IN_REVIEW",
      toDesk: "AREA_MANAGER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      outcome: "REJECTED",
      clearOutcome: false,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "AREA_MANAGER",
      action: "REJECT",
      reason: "Head of Training rejected the training implementation",
      workItemTitle: "Release rejected training implementation",
      workItemSummary: "was rejected by the Head of Training and awaits Area Manager release.",
    },
    hot_to_ro: {
      from: ["SUBMITTED"],
      fromDesk: "HEAD_OF_TRAINING",
      toStatus: "CHANGES_REQUESTED",
      toDesk: "REIMBURSEMENT_OFFICER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "REIMBURSEMENT_OFFICER",
      action: "REQUEST_CHANGES",
      reason: "Head of Training returned the monitoring report for correction",
      workItemTitle: "Correct training monitoring report",
      workItemSummary: "has monitoring corrections requested by the Head of Training.",
    },
    am_release: {
      from: ["IN_REVIEW"],
      fromDesk: "AREA_MANAGER",
      toStatus: "IN_REVIEW",
      toDesk: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      outcome: null,
      clearOutcome: false,
      requiresOutcome: true,
      submitted: false,
      release: true,
      assignedRole: null,
      action: "FORWARD",
      reason: "Area Manager released the monitoring decision to the employer",
      workItemTitle: "",
      workItemSummary: "",
    },
    am_to_hot: {
      from: ["IN_REVIEW"],
      fromDesk: "AREA_MANAGER",
      toStatus: "SUBMITTED",
      toDesk: "HEAD_OF_TRAINING",
      allowedRoles: ["AREA_MANAGER"],
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "HEAD_OF_TRAINING",
      action: "REQUEST_CHANGES",
      reason: "Area Manager returned the monitoring decision to Head of Training",
      workItemTitle: "Reconsider training implementation outcome",
      workItemSummary: "has a monitoring decision returned by the Area Manager.",
    },
  } as const;

  return transitions[transition];
}

async function findEditableMonitoringRecord(recordId: string) {
  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: recordId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "IN_REVIEW", "SUBMITTED", "CHANGES_REQUESTED"],
      },
      currentDesk: "REIMBURSEMENT_OFFICER",
      trainingRequest: {
        recordTier: "HOT",
        company: {
          recordTier: "HOT",
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      trainingRequestId: true,
      trainingRequest: {
        select: {
          companyId: true,
          company: {
            select: {
              organizationId: true,
              areaOfficeId: true,
            },
          },
        },
      },
    },
  });

  if (!record) {
    throw new Error("Editable Training Monitoring record was not found.");
  }

  return record;
}

function assertMonitoringEditorRole(requesterRole: Role) {
  if (
    requesterRole !== "SYSTEM_ADMIN" &&
    requesterRole !== "WORKSPACE_APP_ADMIN" &&
    requesterRole !== "REIMBURSEMENT_OFFICER"
  ) {
    throw new Error("Only the Reimbursement Officer can record monitoring findings.");
  }
}

function hasMonitoringRoutingRole(requesterRole: Role, allowedRoles: readonly Role[]) {
  return (
    requesterRole === "SYSTEM_ADMIN" ||
    requesterRole === "WORKSPACE_APP_ADMIN" ||
    allowedRoles.includes(requesterRole)
  );
}

async function assertTrainingMonitoringAccess(input: {
  requesterEmail: string;
  requesterRole: Role;
  areaOfficeId: string | null;
}) {
  const actor = await getDb().user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
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
    actor.memberships.some((membership) => membership.areaOfficeId === input.areaOfficeId);

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office monitoring record.");
  }

  return actor;
}
