import { getDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";
import { parseTrainingParticipantWorkbook } from "@/lib/training-participant-import";

const trainingRequestEvidenceKinds = [
  "TRAINING_REPORT",
  "PAYMENT_RECEIPT",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

const trainingAreas = [
  "Management",
  "Supervisory",
  "Occupational",
  "Health & Safety",
] as const;

export type TrainingArea = (typeof trainingAreas)[number];

export type TrainingRequestEvidenceKind = (typeof trainingRequestEvidenceKinds)[number];

export type CreateTrainingRequestFromLineItemInput = {
  lineItemId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type CreateAdHocTrainingRequestInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  title: string;
  provider: string;
  startsAt: Date;
  endsAt: Date;
  estimatedCost: number;
  deliveryMode: "LOCAL_PHYSICAL" | "LOCAL_ONLINE";
  venue?: string;
  adHocJustification?: string;
  trainingPlanLineItemId?: string;
};

export type UpdateTrainingRequestDetailsInput = {
  requestId: string;
  requesterEmail: string;
  requesterRole: Role;
  title: string;
  description?: string;
  trainingType?: string;
  provider: string;
  venue?: string;
  startsAt: Date;
  endsAt: Date;
  estimatedCost: number;
  expectedOutcome?: string;
  deliveryMode: "LOCAL_PHYSICAL" | "LOCAL_ONLINE";
  onlineUrl?: string;
  onlinePassword?: string;
  onlineMeetingId?: string;
  onlineInstructions?: string;
  adHocJustification?: string;
};

const trainingRequestTransitions = [
  "am_to_hot",
  "hot_to_ro",
  "ro_approve",
  "ro_reject",
  "hot_to_am",
  "am_release",
] as const;

export type TrainingRequestTransition = (typeof trainingRequestTransitions)[number];

export type SubmitTrainingRequestInput = {
  requestId: string;
  requesterEmail: string;
  requesterRole: Role;
  note?: string;
};

export type RouteTrainingRequestInput = {
  requestId: string;
  requesterEmail: string;
  requesterRole: Role;
  transition: TrainingRequestTransition;
  note?: string;
};

export type UploadTrainingRequestEvidenceInput = {
  requestId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: TrainingRequestEvidenceKind;
  file: File;
};

export type TrainingParticipantInput = {
  requestId: string;
  participantId?: string;
  requesterEmail: string;
  requesterRole: Role;
  name: string;
  jobTitle?: string;
  trainingArea?: string;
  educationalQualification?: string;
  nationality?: string;
  courseTitle?: string;
  courseOrganiser?: string;
  venue?: string;
};

export function getTrainingRequestTransitions() {
  return trainingRequestTransitions;
}

export function getTrainingRequestEvidenceKinds() {
  return trainingRequestEvidenceKinds;
}

export function getTrainingAreas() {
  return trainingAreas;
}

export async function listEmployerTrainingRequestCompanies(input: {
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "training:submit")) {
    return [];
  }

  const actor = await getWorkflowActor(input.requesterEmail);
  const organizationIds = actor.memberships
    .map((membership) => membership.organizationId)
    .filter((value): value is string => Boolean(value));

  return getDb().company.findMany({
    where: {
      recordTier: "HOT",
      isActive: true,
      ...(isItfRole(input.requesterRole)
        ? {}
        : { organizationId: { in: organizationIds } }),
    },
    select: {
      id: true,
      legalName: true,
      areaOffice: { select: { name: true } },
    },
    orderBy: { legalName: "asc" },
  });
}

export async function listApprovedTrainingPlanRows(input: {
  companyIds: string[];
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "training:submit") || input.companyIds.length === 0) return [];
  const actor = await getWorkflowActor(input.requesterEmail);
  const allowedOrganizationIds = actor.memberships
    .map((membership) => membership.organizationId)
    .filter((value): value is string => Boolean(value));
  return getDb().trainingPlanLineItem.findMany({
    where: {
      trainingPlanSubmission: {
        companyId: { in: input.companyIds },
        status: "APPROVED",
        recordTier: "HOT",
        ...(!isItfRole(input.requesterRole)
          ? { company: { organizationId: { in: allowedOrganizationIds }, isActive: true } }
          : {}),
      },
    },
    select: {
      id: true,
      trainingTitle: true,
      staffName: true,
      trainingPlanSubmission: { select: { companyId: true, year: true } },
    },
    orderBy: [{ trainingPlanSubmission: { year: "desc" } }, { rowNumber: "asc" }],
  });
}

export async function createAdHocTrainingRequest(input: CreateAdHocTrainingRequestInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to create Training Approval Requests.");
  }

  if (input.endsAt < input.startsAt) {
    throw new Error("Training end time cannot be before its start time.");
  }

  if (!Number.isFinite(input.estimatedCost) || input.estimatedCost <= 0) {
    throw new Error("Estimated cost must be greater than zero.");
  }

  const db = getDb();
  const company = await db.company.findFirst({
    where: { id: input.companyId, recordTier: "HOT", isActive: true },
    select: { id: true, organizationId: true },
  });
  const actor = await getWorkflowActor(input.requesterEmail);

  if (!company) {
    throw new Error("Selected company was not found.");
  }

  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: company.organizationId,
  });

  if (input.trainingPlanLineItemId) {
    const source = await db.trainingPlanLineItem.findFirst({
      where: {
        id: input.trainingPlanLineItemId,
        trainingPlanSubmission: {
          companyId: company.id,
          status: "APPROVED",
          recordTier: "HOT",
        },
      },
      select: { id: true },
    });
    if (!source) throw new Error("Selected Training Plan row is not approved for this company.");
  }

  return db.trainingRequest.create({
    data: {
      companyId: company.id,
      trainingPlanLineItemId: input.trainingPlanLineItemId || null,
      isAdHoc: !input.trainingPlanLineItemId,
      adHocJustification: input.adHocJustification?.trim() || null,
      title: input.title.trim(),
      provider: input.provider.trim(),
      venue: input.deliveryMode === "LOCAL_PHYSICAL" ? input.venue : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      estimatedCost: input.estimatedCost,
      deliveryMode: input.deliveryMode,
      status: "DRAFT",
      currentDesk: "COMPANY",
    },
    select: { id: true },
  });
}

export async function updateTrainingRequestDetails(input: UpdateTrainingRequestDetailsInput) {
  const request = await findEditableTrainingRequestForEmployer(input);
  const actor = await getWorkflowActor(input.requesterEmail);

  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: request.company.organizationId,
  });

  if (input.endsAt < input.startsAt) {
    throw new Error("Training end time cannot be before its start time.");
  }

  if (input.deliveryMode === "LOCAL_ONLINE" && !input.onlineUrl?.trim()) {
    throw new Error("Online training URL is required.");
  }

  return getDb().trainingRequest.update({
    where: { id: request.id },
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      trainingType: input.trainingType?.trim() || null,
      provider: input.provider.trim(),
      venue: input.deliveryMode === "LOCAL_PHYSICAL" ? input.venue?.trim() || null : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      estimatedCost: input.estimatedCost,
      expectedOutcome: input.expectedOutcome?.trim() || null,
      deliveryMode: input.deliveryMode,
      onlineUrl: input.deliveryMode === "LOCAL_ONLINE" ? input.onlineUrl?.trim() || null : null,
      onlinePassword:
        input.deliveryMode === "LOCAL_ONLINE" ? input.onlinePassword?.trim() || null : null,
      onlineMeetingId:
        input.deliveryMode === "LOCAL_ONLINE" ? input.onlineMeetingId?.trim() || null : null,
      onlineInstructions:
        input.deliveryMode === "LOCAL_ONLINE" ? input.onlineInstructions?.trim() || null : null,
      adHocJustification: request.isAdHoc
        ? input.adHocJustification?.trim() || null
        : request.adHocJustification,
      trainingDetailsUpdatedAt: new Date(),
    },
    select: { id: true },
  });
}

export async function createTrainingRequestFromLineItem(
  input: CreateTrainingRequestFromLineItemInput,
) {
  if (
    input.requesterRole !== "EMPLOYER_ADMIN" &&
    input.requesterRole !== "EMPLOYER_SUBMITTER"
  ) {
    throw new Error("Only employers can create Form 4A requests from Training Plan rows.");
  }

  const db = getDb();
  const lineItem = await db.trainingPlanLineItem.findUnique({
    where: {
      id: input.lineItemId,
    },
    select: {
      id: true,
      trainingTitle: true,
      estimatedCost: true,
      plannedDate: true,
      location: true,
      trainer: true,
      trainingPlanSubmission: {
        select: {
          status: true,
          companyId: true,
          company: {
            select: {
              organizationId: true,
              isActive: true,
              recordTier: true,
            },
          },
        },
      },
    },
  });

  if (!lineItem || lineItem.trainingPlanSubmission.status !== "APPROVED") {
    throw new Error("Training Approval Requests can only be created from approved Training Plan rows.");
  }

  if (
    !lineItem.trainingPlanSubmission.company.isActive ||
    lineItem.trainingPlanSubmission.company.recordTier !== "HOT"
  ) {
    throw new Error("Company is not active.");
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
    requester.memberships.some(
      (membership) =>
        membership.organizationId === lineItem.trainingPlanSubmission.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to create this Training Approval Request.");
  }

  const existingRequest = await db.trainingRequest.findFirst({
    where: { trainingPlanLineItemId: lineItem.id, recordTier: "HOT" },
    select: { id: true, companyId: true },
    orderBy: { createdAt: "asc" },
  });

  if (existingRequest) {
    return existingRequest;
  }

  const startsAt = lineItem.plannedDate ?? new Date();

  return db.trainingRequest.create({
    data: {
      companyId: lineItem.trainingPlanSubmission.companyId,
      trainingPlanLineItemId: lineItem.id,
      title: lineItem.trainingTitle,
      provider: lineItem.trainer,
      venue: lineItem.location,
      startsAt,
      endsAt: startsAt,
      estimatedCost: lineItem.estimatedCost,
      status: "DRAFT",
      currentDesk: "COMPANY",
    },
    select: {
      id: true,
      companyId: true,
    },
  });
}

export async function archiveDraftTrainingRequest(input: {
  requestId: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to remove Training Approval Requests.");
  }

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.requestId,
      recordTier: "HOT",
      status: "DRAFT",
      currentDesk: "COMPANY",
      submittedAt: null,
      company: { recordTier: "HOT", isActive: true },
    },
    select: { company: { select: { organizationId: true } } },
  });

  if (!request) {
    throw new Error("Only unsubmitted draft Training Approval Requests can be removed.");
  }

  const requester = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { memberships: { where: { isActive: true }, select: { organizationId: true } } },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: requester.memberships,
    organizationId: request.company.organizationId,
  });

  const result = await db.trainingRequest.updateMany({
    where: {
      id: input.requestId,
      recordTier: "HOT",
      status: "DRAFT",
      currentDesk: "COMPANY",
      submittedAt: null,
    },
    data: { recordTier: "COLD" },
  });

  if (result.count !== 1) {
    throw new Error("This Training Approval Request is no longer an unsubmitted draft.");
  }
}

export async function updateTrainingRequestSource(input: {
  requestId: string;
  trainingPlanLineItemId?: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  const request = await findEditableTrainingRequestForEmployer(input);
  const actor = await getWorkflowActor(input.requesterEmail);
  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: request.company.organizationId,
  });
  if (input.trainingPlanLineItemId) {
    const source = await getDb().trainingPlanLineItem.findFirst({
      where: {
        id: input.trainingPlanLineItemId,
        trainingPlanSubmission: {
          companyId: request.company.id,
          status: "APPROVED",
          recordTier: "HOT",
        },
      },
      select: { id: true },
    });
    if (!source) throw new Error("Selected Training Plan row is not approved for this company.");
  }
  return getDb().trainingRequest.update({
    where: { id: request.id },
    data: {
      trainingPlanLineItemId: input.trainingPlanLineItemId || null,
      isAdHoc: !input.trainingPlanLineItemId,
    },
    select: { id: true },
  });
}

export async function submitTrainingRequest(input: SubmitTrainingRequestInput) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to submit Training Approval Requests.");
  }

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.requestId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "CHANGES_REQUESTED"],
      },
      currentDesk: "COMPANY",
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      provider: true,
      startsAt: true,
      endsAt: true,
      estimatedCost: true,
      isAdHoc: true,
      adHocJustification: true,
      deliveryMode: true,
      onlineUrl: true,
      _count: {
        select: {
          participants: true,
          documents: true,
        },
      },
      company: {
        select: {
          id: true,
          organizationId: true,
          areaOfficeId: true,
          legalName: true,
          isActive: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!request || !request.company.isActive) {
    throw new Error("Editable Training Approval Request was not found.");
  }

  const actor = await getWorkflowActor(input.requesterEmail);
  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some((membership) => membership.organizationId === request.company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this Training Approval Request.");
  }

  const missingFields = getTrainingRequestMissingRequirements(request);

  if (missingFields.length > 0) {
    throw new Error(`Training Approval Request is incomplete: ${missingFields.join(", ")}.`);
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.trainingRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "SUBMITTED",
        currentDesk: "AREA_MANAGER",
        submittedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: request.companyId,
        trainingRequestId: request.id,
        action: "SUBMIT",
        reason: input.note,
      },
    });

    await createTrainingRequestWorkItem(tx, {
      requestId: request.id,
      companyId: request.companyId,
      organizationId: request.company.organizationId,
      workspaceId: request.company.organization.workspaceId,
      areaOfficeId: request.company.areaOfficeId,
      assignedRole: "AREA_MANAGER",
      title: "Review Form 4A training approval request",
      summary: `${request.company.legalName} submitted a Form 4A training approval request.`,
      sourceSuffix: "area-manager",
    });

    return updated;
  });
}

export function getTrainingRequestMissingRequirements(request: {
  title: string | null;
  provider: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  estimatedCost: { toString(): string } | null;
  isAdHoc: boolean;
  adHocJustification: string | null;
  deliveryMode: "LOCAL_PHYSICAL" | "LOCAL_ONLINE";
  onlineUrl: string | null;
  _count: {
    participants: number;
    documents: number;
  };
}) {
  const missing: string[] = [];

  if (!request.title) {
    missing.push("training title");
  }

  if (!request.provider) {
    missing.push("provider");
  }

  if (!request.startsAt || !request.endsAt) {
    missing.push("training dates");
  }

  if (!request.estimatedCost || Number(request.estimatedCost.toString()) <= 0) {
    missing.push("estimated cost");
  }

  if (request.deliveryMode === "LOCAL_ONLINE" && !request.onlineUrl) {
    missing.push("online training URL");
  }

  if (request._count.participants === 0) {
    missing.push("at least one participant");
  }

  if (request._count.documents === 0) {
    missing.push("at least one evidence document");
  }

  return missing;
}

export async function routeTrainingRequest(input: RouteTrainingRequestInput) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to route Training Approval Requests.");
  }

  const transition = resolveTrainingRequestTransition(input.transition);

  if (!hasTrainingRequestRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error(`Only ${transition.allowedRoles.join(" or ")} can perform this action.`);
  }

  if (transition.outcome && !input.note?.trim()) {
    throw new Error("A reason is required for the Reimbursement Officer's decision.");
  }

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.requestId,
      recordTier: "HOT",
      status: {
        in: [...transition.allowedStatuses],
      },
      currentDesk: transition.from,
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      trainingType: true,
      startsAt: true,
      endsAt: true,
      decisionOutcome: true,
      company: {
        select: {
          areaOfficeId: true,
          organizationId: true,
          legalName: true,
          isActive: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!request || !request.company.isActive) {
    throw new Error("Training Approval Request awaiting this action was not found.");
  }

  const actor = await getWorkflowActor(input.requesterEmail);

  if (
    !hasAreaOfficeAccess({
      requesterRole: input.requesterRole,
      areaOfficeId: request.company.areaOfficeId,
      memberships: actor.memberships,
    })
  ) {
    throw new Error("You do not have access to this Area Office Training Approval Request.");
  }

  return db.$transaction(async (tx) => {
    if (transition.requiresOutcome && !request.decisionOutcome) {
      throw new Error("The Reimbursement Officer must record an approval or rejection first.");
    }

    const decisionOutcome = transition.outcome ?? (transition.clearOutcome ? null : request.decisionOutcome);
    const nextStatus = transition.release
      ? decisionOutcome === "ACCEPTED"
        ? "APPROVED"
        : "REJECTED"
      : transition.nextStatus;
    const now = new Date();
    const updated = await tx.trainingRequest.update({
      where: {
        id: request.id,
      },
      data: {
        currentDesk: transition.to,
        status: nextStatus,
        decisionOutcome,
        decisionReason: transition.outcome ? input.note : transition.clearOutcome ? null : undefined,
        approvedAt: nextStatus === "APPROVED" ? now : undefined,
        feedbackReleasedAt: transition.release ? now : undefined,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: request.companyId,
        trainingRequestId: request.id,
        action: transition.action,
        reason: [transition.reason, input.note].filter(Boolean).join(": "),
      },
    });

    await tx.workItem.updateMany({
      where: {
        sourceKey: {
          startsWith: `training-request:${request.id}:`,
        },
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
      },
    });

    if (transition.assignedRole) {
      await createTrainingRequestWorkItem(tx, {
        requestId: request.id,
        companyId: request.companyId,
        organizationId: request.company.organizationId,
        workspaceId: request.company.organization.workspaceId,
        areaOfficeId: request.company.areaOfficeId,
        assignedRole: transition.assignedRole,
        title: transition.workItemTitle,
        summary: `${request.company.legalName} ${transition.workItemSummary}`,
        sourceSuffix: transition.to.toLowerCase(),
      });
    }

    if (transition.release) {
      await tx.workItem.upsert({
        where: {
          sourceKey: `training-request:${request.id}:employer-feedback`,
        },
        create: {
          workspaceId: request.company.organization.workspaceId,
          organizationId: request.company.organizationId,
          areaOfficeId: request.company.areaOfficeId,
          companyId: request.companyId,
          assignedRole: "EMPLOYER_ADMIN",
          app: "REIMBURSEMENT",
          kind: "TRAINING_FEEDBACK",
          status: "OPEN",
          priority: "NORMAL",
          title: `Form 4A ${nextStatus === "APPROVED" ? "approved" : "rejected"}`,
          summary: `${request.title} has completed Area Office review. Open the request to view the decision and reasons.`,
          targetHref: `/training-requests/${request.id}`,
          sourceKey: `training-request:${request.id}:employer-feedback`,
        },
        update: {
          status: "OPEN",
          resolvedAt: null,
          emailNotifiedAt: null,
          title: `Form 4A ${nextStatus === "APPROVED" ? "approved" : "rejected"}`,
          summary: `${request.title} has completed Area Office review. Open the request to view the decision and reasons.`,
        },
      });
    }

    if (nextStatus === "APPROVED") {
      const existingMonitoringRecord = await tx.trainingMonitoringRecord.findFirst({
        where: {
          trainingRequestId: request.id,
          recordTier: "HOT",
        },
        select: {
          id: true,
        },
      });

      if (!existingMonitoringRecord) {
        const monitoringRecord = await tx.trainingMonitoringRecord.create({
          data: {
            trainingRequestId: request.id,
            mode: request.trainingType?.toLowerCase().includes("virtual")
              ? "LOCAL_VIRTUAL"
              : "LOCAL_PHYSICAL",
            monitoringDate: request.startsAt,
            startsAt: request.startsAt,
            endsAt: request.endsAt,
            status: "DRAFT",
            currentDesk: "REIMBURSEMENT_OFFICER",
          },
          select: {
            id: true,
          },
        });

        await tx.workItem.create({
          data: {
            workspaceId: request.company.organization.workspaceId,
            organizationId: request.company.organizationId,
            areaOfficeId: request.company.areaOfficeId,
            companyId: request.companyId,
            trainingMonitoringRecordId: monitoringRecord.id,
            assignedRole: "REIMBURSEMENT_OFFICER",
            app: "REIMBURSEMENT",
            kind: "TRAINING_MONITORING_REVIEW",
            status: "OPEN",
            priority: "NORMAL",
            title: "Monitor approved training",
            summary: `${request.company.legalName}'s approved training is scheduled for monitoring.`,
            targetHref: `/training-monitoring/${monitoringRecord.id}`,
            sourceKey: `training-monitoring:${monitoringRecord.id}:reimbursement-officer`,
          },
        });
      }
    }

    return updated;
  });
}

export async function uploadTrainingRequestEvidence(input: UploadTrainingRequestEvidenceInput) {
  if (!can(input.requesterRole, "training:submit") && !can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to upload Training Approval evidence.");
  }

  await assertUploadRateLimit(input.uploadedByEmail);

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.requestId,
      recordTier: "HOT",
      company: {
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
        },
      },
    },
  });

  if (!request) {
    throw new Error("Training Approval Request was not found.");
  }

  const actor = await getWorkflowActor(input.uploadedByEmail);
  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some((membership) => membership.organizationId === request.company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to upload evidence for this request.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: request.companyId,
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "training-requests",
  });

  return db.document.create({
    data: {
      organizationId: request.company.organizationId,
      companyId: request.companyId,
      trainingRequestId: request.id,
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

export async function addTrainingParticipant(input: TrainingParticipantInput) {
  const request = await findEditableTrainingRequestForEmployer(input);
  const actor = await getWorkflowActor(input.requesterEmail);

  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: request.company.organizationId,
  });

  return getDb().trainingParticipant.create({
    data: buildTrainingParticipantData(input, request.id),
    select: {
      id: true,
    },
  });
}

export async function importTrainingParticipants(input: {
  requestId: string;
  requesterEmail: string;
  requesterRole: Role;
  file: File;
}) {
  const request = await findEditableTrainingRequestForEmployer(input);
  const actor = await getWorkflowActor(input.requesterEmail);
  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: request.company.organizationId,
  });
  const rows = await parseTrainingParticipantWorkbook(input.file, trainingAreas);
  await getDb().trainingParticipant.createMany({
    data: rows.map((row) => ({ trainingRequestId: request.id, ...row })),
  });
  return rows.length;
}

export async function updateTrainingParticipant(input: TrainingParticipantInput) {
  if (!input.participantId) {
    throw new Error("Training participant is required.");
  }

  const request = await findEditableTrainingRequestForEmployer(input);
  const actor = await getWorkflowActor(input.requesterEmail);

  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: request.company.organizationId,
  });

  return getDb().trainingParticipant.update({
    where: {
      id: input.participantId,
      trainingRequestId: request.id,
    },
    data: buildTrainingParticipantData(input, request.id),
    select: {
      id: true,
    },
  });
}

export async function deleteTrainingParticipant(input: {
  requestId: string;
  participantId: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  const request = await findEditableTrainingRequestForEmployer(input);
  const actor = await getWorkflowActor(input.requesterEmail);

  assertTrainingRequestOrganizationAccess({
    requesterRole: input.requesterRole,
    memberships: actor.memberships,
    organizationId: request.company.organizationId,
  });

  return getDb().trainingParticipant.delete({
    where: {
      id: input.participantId,
      trainingRequestId: request.id,
    },
    select: {
      id: true,
    },
  });
}

async function getWorkflowActor(email: string) {
  const actor = await getDb().user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  return actor;
}

async function findEditableTrainingRequestForEmployer(input: {
  requestId: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to edit Training Approval participants.");
  }

  const request = await getDb().trainingRequest.findFirst({
    where: {
      id: input.requestId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "CHANGES_REQUESTED"],
      },
      currentDesk: "COMPANY",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      isAdHoc: true,
      adHocJustification: true,
      company: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Editable Training Approval Request was not found.");
  }

  return request;
}

function buildTrainingParticipantData(input: TrainingParticipantInput, requestId: string) {
  return {
    trainingRequestId: requestId,
    name: input.name,
    jobTitle: input.jobTitle,
    trainingArea: input.trainingArea,
    educationalQualification: input.educationalQualification,
    nationality: input.nationality,
    courseTitle: input.courseTitle,
    courseOrganiser: input.courseOrganiser,
    venue: input.venue,
  };
}

function assertTrainingRequestOrganizationAccess(input: {
  requesterRole: Role;
  memberships: { organizationId: string | null }[];
  organizationId: string;
}) {
  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    input.memberships.some((membership) => membership.organizationId === input.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to edit this Training Approval Request.");
  }
}

async function createTrainingRequestWorkItem(
  tx: Prisma.TransactionClient,
  input: {
    requestId: string;
    companyId: string;
    organizationId: string;
    workspaceId: string;
    areaOfficeId: string | null;
    assignedRole: Role;
    title: string;
    summary: string;
    sourceSuffix: string;
  },
) {
  return tx.workItem.upsert({
    where: {
      sourceKey: `training-request:${input.requestId}:${input.sourceSuffix}`,
    },
    create: {
      workspaceId: input.workspaceId,
      organizationId: input.organizationId,
      areaOfficeId: input.areaOfficeId,
      companyId: input.companyId,
      assignedRole: input.assignedRole,
      app: "REIMBURSEMENT",
      kind: "TRAINING_REQUEST_REVIEW",
      status: "OPEN",
      priority: "NORMAL",
      title: input.title,
      summary: input.summary,
      targetHref: `/training-requests/${input.requestId}`,
      sourceKey: `training-request:${input.requestId}:${input.sourceSuffix}`,
    },
    update: {
      status: "OPEN",
      resolvedAt: null,
      emailNotifiedAt: null,
      assignedRole: input.assignedRole,
      title: input.title,
      summary: input.summary,
      targetHref: `/training-requests/${input.requestId}`,
    },
  });
}

function resolveTrainingRequestTransition(transition: TrainingRequestTransition) {
  const transitions = {
    am_to_hot: {
      from: "AREA_MANAGER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      release: false,
      assignedRole: "HEAD_OF_TRAINING",
      action: "FORWARD",
      reason: "AM forwarded Training Approval Request to Head of Training",
      workItemTitle: "Review Form 4A training approval request",
      workItemSummary: "is awaiting Head of Training review.",
    },
    hot_to_ro: {
      from: "HEAD_OF_TRAINING",
      to: "REIMBURSEMENT_OFFICER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW", "CHANGES_REQUESTED"],
      nextStatus: "IN_REVIEW",
      outcome: null,
      clearOutcome: true,
      requiresOutcome: false,
      release: false,
      assignedRole: "REIMBURSEMENT_OFFICER",
      action: "FORWARD",
      reason: "HOT forwarded Training Approval Request to Reimbursement Officer",
      workItemTitle: "Decide Form 4A training approval request",
      workItemSummary: "is awaiting the Reimbursement Officer's approval decision.",
    },
    ro_approve: {
      from: "REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      outcome: "ACCEPTED",
      clearOutcome: false,
      requiresOutcome: false,
      release: false,
      assignedRole: "HEAD_OF_TRAINING",
      action: "APPROVE",
      reason: "Reimbursement Officer approved Training Approval Request",
      workItemTitle: "Review Form 4A approval feedback",
      workItemSummary: "was approved by the Reimbursement Officer and is awaiting feedback review.",
    },
    ro_reject: {
      from: "REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      outcome: "REJECTED",
      clearOutcome: false,
      requiresOutcome: false,
      release: false,
      assignedRole: "HEAD_OF_TRAINING",
      action: "REJECT",
      reason: "Reimbursement Officer rejected Training Approval Request",
      workItemTitle: "Review Form 4A rejection feedback",
      workItemSummary: "was rejected by the Reimbursement Officer and is awaiting feedback review.",
    },
    hot_to_am: {
      from: "HEAD_OF_TRAINING",
      to: "AREA_MANAGER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      outcome: null,
      clearOutcome: false,
      requiresOutcome: true,
      release: false,
      assignedRole: "AREA_MANAGER",
      action: "FORWARD",
      reason: "HOT forwarded the Reimbursement Officer decision to AM",
      workItemTitle: "Release Form 4A decision to employer",
      workItemSummary: "has completed review and is awaiting Area Manager feedback release.",
    },
    am_release: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      outcome: null,
      clearOutcome: false,
      requiresOutcome: true,
      release: true,
      assignedRole: null,
      action: "FORWARD",
      reason: "AM released the Training Approval Request decision to the employer",
      workItemTitle: "",
      workItemSummary: "",
    },
  } as const;

  return transitions[transition];
}

function hasTrainingRequestRoutingRole(requesterRole: Role, allowedRoles: readonly Role[]) {
  return (
    requesterRole === "SYSTEM_ADMIN" ||
    requesterRole === "WORKSPACE_APP_ADMIN" ||
    allowedRoles.includes(requesterRole)
  );
}

function hasAreaOfficeAccess(input: {
  requesterRole: Role;
  areaOfficeId: string | null;
  memberships: { areaOfficeId: string | null }[];
}) {
  if (input.requesterRole === "SYSTEM_ADMIN" || input.requesterRole === "WORKSPACE_APP_ADMIN") {
    return true;
  }

  return input.memberships.some((membership) => membership.areaOfficeId === input.areaOfficeId);
}
