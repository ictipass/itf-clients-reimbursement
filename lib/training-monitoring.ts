import { getDb } from "@/lib/db";
import type { Prisma, TrainingMonitoringMode } from "@/lib/generated/prisma/client";
import { canMonitorAtDesk, isMonitoringHeadquartersRole } from "@/lib/monitoring-routing";
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
  "hq_ro_submit",
  "hod_accept",
  "hod_reject",
  "hod_to_hq_ro",
  "dfsd_release",
  "dfsd_to_hod",
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
  assigneeUserId?: string;
};

export async function listAssignableVirtualMonitoringOfficers(workspaceId: string) {
  return getDb().user.findMany({
    where: {
      isActive: true,
      memberships: { some: {
        isActive: true,
        role: "HQ_REIMBURSEMENT_OFFICER",
        workspaceId,
        areaOfficeId: null,
      } },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export function selectVirtualMonitoringOfficer(
  officers: readonly { id: string; name: string; email: string }[],
  requestedId?: string,
) {
  if (!officers.length) throw new Error("No active HQ Reimbursement Officer is available in this workspace.");
  if (!requestedId && officers.length > 1) throw new Error("Select the HQ Reimbursement Officer who will receive this monitoring record.");
  const assignee = officers.find((officer) => officer.id === (requestedId ?? officers[0].id));
  if (!assignee) throw new Error("The selected HQ Reimbursement Officer is no longer available.");
  return assignee;
}

async function resolveVirtualMonitoringAssignee(workspaceId: string, requestedId?: string) {
  return selectVirtualMonitoringOfficer(await listAssignableVirtualMonitoringOfficers(workspaceId), requestedId);
}

export async function assignVirtualMonitoringOfficer(input: {
  recordId: string;
  requesterEmail: string;
  requesterRole: Role;
  assigneeUserId: string;
  reason?: string;
}) {
  const db = getDb();
  const record = await db.trainingMonitoringRecord.findFirst({
    where: {
      id: input.recordId,
      recordTier: "HOT",
      mode: "LOCAL_VIRTUAL",
      currentDesk: "HQ_REIMBURSEMENT_OFFICER",
      status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
    },
    select: {
      id: true,
      trainingRequestId: true,
      trainingRequest: { select: { companyId: true, company: { select: { organization: { select: { workspaceId: true } } } } } },
    },
  });
  if (!record) throw new Error("This virtual monitoring record is no longer awaiting an HQ officer.");
  const workspaceId = record.trainingRequest.company.organization.workspaceId;
  const actor = await db.user.findFirst({
    where: {
      email: input.requesterEmail,
      isActive: true,
      memberships: { some: {
        isActive: true,
        workspaceId,
        ...(input.requesterRole === "HEAD_OF_DIVISION"
          ? { role: "HEAD_OF_DIVISION", areaOfficeId: null }
          : { role: input.requesterRole }),
      } },
    },
    select: { id: true },
  });
  if (!actor || !["HEAD_OF_DIVISION", "SYSTEM_ADMIN", "WORKSPACE_APP_ADMIN"].includes(input.requesterRole)) {
    throw new Error("Only the Head of Reimbursement Division or a workspace administrator may assign this HQ monitoring record.");
  }
  const officers = await listAssignableVirtualMonitoringOfficers(workspaceId);
  const assignee = officers.find((officer) => officer.id === input.assigneeUserId);
  if (!assignee) throw new Error("Select an active HQ Reimbursement Officer in this workspace.");
  const workItem = await db.workItem.findFirst({
    where: {
      trainingMonitoringRecordId: record.id,
      app: "REIMBURSEMENT",
      recordTier: "HOT",
      status: "OPEN",
      kind: "TRAINING_MONITORING_REVIEW",
      assignedRole: { in: ["HEAD_OF_DIVISION", "HQ_REIMBURSEMENT_OFFICER"] },
    },
    select: { id: true, assignedRole: true, assignedUserId: true },
  });
  if (!workItem) throw new Error("The monitoring assignment is no longer open.");
  if (workItem.assignedUserId === assignee.id) throw new Error("This officer already holds the monitoring record.");
  const reason = input.reason?.trim();
  if (workItem.assignedUserId && !reason) throw new Error("Record a reason for reassigning this monitoring record.");

  await db.$transaction(async (tx) => {
    const current = await tx.trainingMonitoringRecord.updateMany({
      where: { id: record.id, currentDesk: "HQ_REIMBURSEMENT_OFFICER", status: { in: ["DRAFT", "CHANGES_REQUESTED"] } },
      data: { monitoringOfficerName: assignee.name, monitoringOfficerTitle: "HQ Reimbursement Officer" },
    });
    if (current.count !== 1) throw new Error("This monitoring record has already moved to another desk.");
    const updated = await tx.workItem.updateMany({
      where: {
        id: workItem.id,
        status: "OPEN",
        assignedRole: workItem.assignedRole,
        assignedUserId: workItem.assignedUserId,
      },
      data: {
        assignedRole: "HQ_REIMBURSEMENT_OFFICER",
        assignedUserId: assignee.id,
        emailNotifiedAt: null,
      },
    });
    if (updated.count !== 1) throw new Error("The monitoring assignment changed. Reload and try again.");
    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: record.trainingRequest.companyId,
        trainingRequestId: record.trainingRequestId,
        trainingMonitoringRecordId: record.id,
        action: "FORWARD",
        reason: `${workItem.assignedUserId ? "Reassigned" : "Assigned"} virtual monitoring to ${assignee.name} (${assignee.email})${reason ? `. Reason: ${reason}` : ""}`,
      },
    });
  });
}

export function getTrainingMonitoringEvidenceKinds() {
  return trainingMonitoringEvidenceKinds;
}

export function getTrainingMonitoringTransitions() {
  return trainingMonitoringTransitions;
}

export function isMonitoringTransitionForMode(transition: TrainingMonitoringTransition, mode: TrainingMonitoringMode) {
  const virtual = transition.startsWith("hq_") || transition.startsWith("hod_") || transition.startsWith("dfsd_");
  return (mode === "LOCAL_VIRTUAL") === virtual;
}

export async function uploadTrainingMonitoringEvidence(
  input: UploadTrainingMonitoringEvidenceInput,
) {
  if (!can(input.requesterRole, "training:approve") && !isMonitoringHeadquartersRole(input.requesterRole) && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
    throw new Error("You do not have permission to upload Training Monitoring evidence.");
  }

  assertMonitoringEditorRole(input.requesterRole);

  await assertUploadRateLimit(input.uploadedByEmail);

  const db = getDb();
  const record = await findEditableMonitoringRecord(input.recordId);

  const actor = await assertTrainingMonitoringAccess({
    requesterEmail: input.uploadedByEmail,
    requesterRole: input.requesterRole,
    mode: record.mode,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
    workspaceId: record.trainingRequest.company.organization.workspaceId,
  });
  await assertVirtualMonitoringAssignee(record.id, actor.id, input.requesterRole, record.mode);

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
  await assertVirtualMonitoringAssignee(record.id, actor.id, input.requesterRole, record.mode);

  return db.$transaction(async (tx) => {
    await lockVirtualMonitoringAssignee(tx, record.id, actor.id, input.requesterRole, record.mode);
    return tx.document.create({
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
      select: { id: true },
    });
  });
}

export async function addTrainingMonitoringEvaluation(
  input: AddTrainingMonitoringEvaluationInput,
) {
  if (!can(input.requesterRole, "training:approve") && !isMonitoringHeadquartersRole(input.requesterRole) && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
    throw new Error("You do not have permission to evaluate Training Monitoring records.");
  }

  assertMonitoringEditorRole(input.requesterRole);

  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    throw new Error("Evaluation score must be between 1 and 5.");
  }

  const record = await findEditableMonitoringRecord(input.recordId);

  const actor = await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    mode: record.mode,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
    workspaceId: record.trainingRequest.company.organization.workspaceId,
  });
  await assertVirtualMonitoringAssignee(record.id, actor.id, input.requesterRole, record.mode);

  return getDb().$transaction(async (tx) => {
    await lockVirtualMonitoringAssignee(tx, record.id, actor.id, input.requesterRole, record.mode);
    return tx.trainingMonitoringEvaluation.create({
      data: {
        trainingMonitoringRecordId: record.id,
        section: input.section,
        ratingArea: input.ratingArea,
        score: input.score,
        note: input.note,
      },
      select: { id: true },
    });
  });
}

export async function updateTrainingMonitoringRecord(
  input: UpdateTrainingMonitoringRecordInput,
) {
  if (!can(input.requesterRole, "training:approve") && !isMonitoringHeadquartersRole(input.requesterRole) && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
    throw new Error("You do not have permission to update Training Monitoring records.");
  }

  assertMonitoringEditorRole(input.requesterRole);

  const record = await findEditableMonitoringRecord(input.recordId);

  const actor = await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    mode: record.mode,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
    workspaceId: record.trainingRequest.company.organization.workspaceId,
  });
  await assertVirtualMonitoringAssignee(record.id, actor.id, input.requesterRole, record.mode);

  const updated = await getDb().trainingMonitoringRecord.updateMany({
    where: {
      id: record.id,
      currentDesk: record.currentDesk,
      status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
      ...(record.mode === "LOCAL_VIRTUAL" && input.requesterRole === "HQ_REIMBURSEMENT_OFFICER" ? {
        workItems: { some: {
          app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN",
          assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: actor.id,
        } },
      } : {}),
    },
    data: {
      monitoringDate: input.monitoringDate,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      meetingId: input.meetingId,
      passcode: input.passcode,
      virtualLink: input.virtualLink,
      monitoringOfficerName: record.mode === "LOCAL_VIRTUAL" ? undefined : input.monitoringOfficerName,
      monitoringOfficerTitle: record.mode === "LOCAL_VIRTUAL" ? undefined : input.monitoringOfficerTitle,
      headOfDivisionName: input.headOfDivisionName,
      directorName: input.directorName,
    },
  });
  if (updated.count !== 1) throw new Error("This monitoring assignment changed. Reload the record before editing.");
  return { id: record.id };
}

export async function routeTrainingMonitoringRecord(
  input: RouteTrainingMonitoringRecordInput,
) {
  if (!can(input.requesterRole, "training:approve") && !isMonitoringHeadquartersRole(input.requesterRole) && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
    throw new Error("You do not have permission to route Training Monitoring records.");
  }

  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: input.recordId,
      recordTier: "HOT",
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
      mode: true,
      status: true,
      currentDesk: true,
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

  const transition = resolveTrainingMonitoringTransition(input.transition, record.mode);
  if (record.currentDesk !== transition.fromDesk || !(transition.from as readonly string[]).includes(record.status)) {
    throw new Error("Training Monitoring record is no longer at this workflow desk.");
  }
  if (transition.outcome && !input.note?.trim()) {
    throw new Error("A reason is required for the monitoring implementation decision.");
  }

  const actor = await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    mode: record.mode,
    areaOfficeId: record.trainingRequest.company.areaOfficeId,
    workspaceId: record.trainingRequest.company.organization.workspaceId,
  });

  if (!canMonitorAtDesk(input.requesterRole, record.mode, record.currentDesk) || !hasMonitoringRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error(`Only ${transition.allowedRoles.join(" or ")} can perform this action.`);
  }

  const hqAssignee = transition.toDesk === "HQ_REIMBURSEMENT_OFFICER"
    ? await resolveVirtualMonitoringAssignee(record.trainingRequest.company.organization.workspaceId, input.assigneeUserId)
    : null;

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
    const updated = await tx.trainingMonitoringRecord.updateMany({
      where: {
        id: record.id,
        currentDesk: transition.fromDesk,
        status: { in: [...transition.from] },
      },
      data: {
        status: nextStatus,
        currentDesk: transition.toDesk,
        decisionOutcome,
        decisionReason: transition.outcome ? input.note : transition.clearOutcome ? null : undefined,
        monitoringOfficerName: hqAssignee?.name,
        monitoringOfficerTitle: hqAssignee ? "HQ Reimbursement Officer" : undefined,
        submittedAt: transition.submitted ? now : undefined,
        decidedAt: transition.outcome ? now : undefined,
        feedbackReleasedAt: transition.release ? now : undefined,
      },
    });
    if (updated.count !== 1) throw new Error("This monitoring record has already moved to another desk.");

    if (transition.fromDesk === "HQ_REIMBURSEMENT_OFFICER" && input.requesterRole === "HQ_REIMBURSEMENT_OFFICER") {
      const assigned = await tx.workItem.updateMany({
        where: {
          trainingMonitoringRecordId: record.id,
          app: "REIMBURSEMENT",
          recordTier: "HOT",
          status: "OPEN",
          assignedRole: "HQ_REIMBURSEMENT_OFFICER",
          assignedUserId: actor.id,
        },
        data: { status: "RESOLVED", resolvedAt: now },
      });
      if (assigned.count !== 1) throw new Error("Only the assigned HQ Reimbursement Officer may submit this monitoring report.");
    }

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
          areaOfficeId: record.mode === "LOCAL_VIRTUAL" ? null : record.trainingRequest.company.areaOfficeId,
          companyId: record.trainingRequest.companyId,
          trainingMonitoringRecordId: record.id,
          assignedRole: transition.assignedRole,
          assignedUserId: hqAssignee?.id ?? null,
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
          assignedUserId: hqAssignee?.id ?? null,
          areaOfficeId: record.mode === "LOCAL_VIRTUAL" ? null : record.trainingRequest.company.areaOfficeId,
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

    return { id: record.id };
  });
}

function resolveTrainingMonitoringTransition(transition: TrainingMonitoringTransition, mode: TrainingMonitoringMode) {
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
    hq_ro_submit: {
      from: ["DRAFT", "CHANGES_REQUESTED"],
      fromDesk: "HQ_REIMBURSEMENT_OFFICER",
      toStatus: "SUBMITTED",
      toDesk: "HEAD_OF_DIVISION",
      allowedRoles: ["HQ_REIMBURSEMENT_OFFICER"],
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      submitted: true,
      release: false,
      assignedRole: "HEAD_OF_DIVISION",
      action: "SUBMIT",
      reason: "HQ Reimbursement Officer submitted the virtual monitoring report",
      workItemTitle: "Decide virtual training implementation outcome",
      workItemSummary: "has a virtual monitoring report awaiting Head of Reimbursement Division decision.",
    },
    hod_accept: {
      from: ["SUBMITTED"],
      fromDesk: "HEAD_OF_DIVISION",
      toStatus: "IN_REVIEW",
      toDesk: "DIRECTOR_FSD",
      allowedRoles: ["HEAD_OF_DIVISION"],
      outcome: "ACCEPTED",
      clearOutcome: false,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "DIRECTOR_FSD",
      action: "APPROVE",
      reason: "Head of Reimbursement Division accepted the virtual training implementation",
      workItemTitle: "Release accepted virtual training implementation",
      workItemSummary: "was accepted by the Head of Reimbursement Division and awaits DFSD release.",
    },
    hod_reject: {
      from: ["SUBMITTED"],
      fromDesk: "HEAD_OF_DIVISION",
      toStatus: "IN_REVIEW",
      toDesk: "DIRECTOR_FSD",
      allowedRoles: ["HEAD_OF_DIVISION"],
      outcome: "REJECTED",
      clearOutcome: false,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "DIRECTOR_FSD",
      action: "REJECT",
      reason: "Head of Reimbursement Division rejected the virtual training implementation",
      workItemTitle: "Release rejected virtual training implementation",
      workItemSummary: "was rejected by the Head of Reimbursement Division and awaits DFSD release.",
    },
    hod_to_hq_ro: {
      from: ["SUBMITTED"],
      fromDesk: "HEAD_OF_DIVISION",
      toStatus: "CHANGES_REQUESTED",
      toDesk: "HQ_REIMBURSEMENT_OFFICER",
      allowedRoles: ["HEAD_OF_DIVISION"],
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "HQ_REIMBURSEMENT_OFFICER",
      action: "REQUEST_CHANGES",
      reason: "Head of Reimbursement Division returned the virtual monitoring report for correction",
      workItemTitle: "Correct virtual training monitoring report",
      workItemSummary: "has monitoring corrections requested by the Head of Reimbursement Division.",
    },
    dfsd_release: {
      from: ["IN_REVIEW"],
      fromDesk: "DIRECTOR_FSD",
      toStatus: "IN_REVIEW",
      toDesk: "COMPANY",
      allowedRoles: ["DIRECTOR_FSD"],
      outcome: null,
      clearOutcome: false,
      requiresOutcome: true,
      submitted: false,
      release: true,
      assignedRole: null,
      action: "FORWARD",
      reason: "DFSD released the virtual monitoring decision to the employer",
      workItemTitle: "",
      workItemSummary: "",
    },
    dfsd_to_hod: {
      from: ["IN_REVIEW"],
      fromDesk: "DIRECTOR_FSD",
      toStatus: "SUBMITTED",
      toDesk: "HEAD_OF_DIVISION",
      allowedRoles: ["DIRECTOR_FSD"],
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      submitted: false,
      release: false,
      assignedRole: "HEAD_OF_DIVISION",
      action: "REQUEST_CHANGES",
      reason: "DFSD returned the virtual monitoring decision to Head of Reimbursement Division",
      workItemTitle: "Reconsider virtual training implementation outcome",
      workItemSummary: "has a monitoring decision returned by DFSD.",
    },
  } as const;
  if (!isMonitoringTransitionForMode(transition, mode)) {
    throw new Error("This workflow action does not belong to the monitoring mode.");
  }
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
      currentDesk: { in: ["REIMBURSEMENT_OFFICER", "HQ_REIMBURSEMENT_OFFICER"] },
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
      mode: true,
      currentDesk: true,
      trainingRequestId: true,
      trainingRequest: {
        select: {
          companyId: true,
          company: {
            select: {
              organizationId: true,
              areaOfficeId: true,
              organization: { select: { workspaceId: true } },
            },
          },
        },
      },
    },
  });

  if (!record) {
    throw new Error("Editable Training Monitoring record was not found.");
  }

  if (record.mode === "LOCAL_VIRTUAL" ? record.currentDesk !== "HQ_REIMBURSEMENT_OFFICER" : record.currentDesk !== "REIMBURSEMENT_OFFICER") {
    throw new Error("Monitoring record is not at the appropriate officer desk.");
  }

  return record;
}

function assertMonitoringEditorRole(requesterRole: Role) {
  if (
    requesterRole !== "SYSTEM_ADMIN" &&
    requesterRole !== "WORKSPACE_APP_ADMIN" &&
    requesterRole !== "REIMBURSEMENT_OFFICER"
    && requesterRole !== "HQ_REIMBURSEMENT_OFFICER"
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
  mode: TrainingMonitoringMode;
  areaOfficeId: string | null;
  workspaceId: string;
}) {
  const actor = await getDb().user.findUnique({
    where: {
      email: input.requesterEmail,
      isActive: true,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
          role: true,
          workspaceId: true,
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
    actor.memberships.some((membership) => membership.role === input.requesterRole && membership.workspaceId === input.workspaceId &&
      (input.mode === "LOCAL_VIRTUAL"
        ? isMonitoringHeadquartersRole(input.requesterRole) && !membership.areaOfficeId
        : membership.areaOfficeId !== null && membership.areaOfficeId === input.areaOfficeId));

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office monitoring record.");
  }

  return actor;
}

async function assertVirtualMonitoringAssignee(recordId: string, actorId: string, role: Role, mode: TrainingMonitoringMode) {
  if (mode !== "LOCAL_VIRTUAL" || role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN") return;
  const assignment = await getDb().workItem.findFirst({
    where: {
      trainingMonitoringRecordId: recordId,
      app: "REIMBURSEMENT",
      recordTier: "HOT",
      status: "OPEN",
      assignedRole: "HQ_REIMBURSEMENT_OFFICER",
      assignedUserId: actorId,
    },
    select: { id: true },
  });
  if (!assignment) throw new Error("Only the assigned HQ Reimbursement Officer may edit this monitoring record.");
}

async function lockVirtualMonitoringAssignee(
  tx: Prisma.TransactionClient,
  recordId: string,
  actorId: string,
  role: Role,
  mode: TrainingMonitoringMode,
) {
  if (mode !== "LOCAL_VIRTUAL" || role !== "HQ_REIMBURSEMENT_OFFICER") return;
  const current = await tx.trainingMonitoringRecord.updateMany({
    where: {
      id: recordId,
      currentDesk: "HQ_REIMBURSEMENT_OFFICER",
      status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
      workItems: { some: {
        app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN",
        assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: actorId,
      } },
    },
    data: { updatedAt: new Date() },
  });
  if (current.count !== 1) throw new Error("This monitoring assignment changed. Reload the record before saving.");
}
