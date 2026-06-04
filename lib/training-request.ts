import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const trainingRequestEvidenceKinds = [
  "TRAINING_REPORT",
  "PAYMENT_RECEIPT",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

export type TrainingRequestEvidenceKind = (typeof trainingRequestEvidenceKinds)[number];

export type CreateTrainingRequestFromLineItemInput = {
  lineItemId: string;
  requesterEmail: string;
  requesterRole: Role;
};

const trainingRequestTransitions = [
  "am_to_hot",
  "am_to_company",
  "hot_to_ro",
  "hot_to_company",
  "ro_to_hot",
  "ro_to_company",
  "hot_to_am",
  "am_approve",
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

export async function createTrainingRequestFromLineItem(
  input: CreateTrainingRequestFromLineItemInput,
) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to create Training Approval Requests.");
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
      (membership) =>
        membership.organizationId === lineItem.trainingPlanSubmission.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to create this Training Approval Request.");
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
      company: {
        select: {
          organizationId: true,
          isActive: true,
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

    return updated;
  });
}

export async function routeTrainingRequest(input: RouteTrainingRequestInput) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to route Training Approval Requests.");
  }

  const transition = resolveTrainingRequestTransition(input.transition);

  if (!hasTrainingRequestRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error(`Only ${transition.allowedRoles.join(" or ")} can perform this action.`);
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
      company: {
        select: {
          areaOfficeId: true,
          isActive: true,
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
    const updated = await tx.trainingRequest.update({
      where: {
        id: request.id,
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
        companyId: request.companyId,
        trainingRequestId: request.id,
        action: transition.action,
        reason: [transition.reason, input.note].filter(Boolean).join(": "),
      },
    });

    return updated;
  });
}

export async function uploadTrainingRequestEvidence(input: UploadTrainingRequestEvidenceInput) {
  if (!can(input.requesterRole, "training:submit") && !can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to upload Training Approval evidence.");
  }

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
      company: {
        select: {
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

function resolveTrainingRequestTransition(transition: TrainingRequestTransition) {
  const transitions = {
    am_to_hot: {
      from: "AREA_MANAGER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      action: "FORWARD",
      reason: "AM forwarded Training Approval Request to Head of Training",
    },
    am_to_company: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["SUBMITTED", "IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      action: "REQUEST_CHANGES",
      reason: "AM requested employer correction on Training Approval Request",
    },
    hot_to_ro: {
      from: "HEAD_OF_TRAINING",
      to: "REIMBURSEMENT_OFFICER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      action: "FORWARD",
      reason: "HOT forwarded Training Approval Request to Reimbursement Officer",
    },
    hot_to_company: {
      from: "HEAD_OF_TRAINING",
      to: "COMPANY",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      action: "REQUEST_CHANGES",
      reason: "HOT requested employer correction on Training Approval Request",
    },
    ro_to_hot: {
      from: "REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_TRAINING",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      action: "RECOMMEND",
      reason: "Reimbursement Officer returned Training Approval Request to HOT",
    },
    ro_to_company: {
      from: "REIMBURSEMENT_OFFICER",
      to: "COMPANY",
      allowedRoles: ["REIMBURSEMENT_OFFICER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "CHANGES_REQUESTED",
      action: "REQUEST_CHANGES",
      reason: "Reimbursement Officer requested employer correction on Training Approval Request",
    },
    hot_to_am: {
      from: "HEAD_OF_TRAINING",
      to: "AREA_MANAGER",
      allowedRoles: ["HEAD_OF_TRAINING"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "IN_REVIEW",
      action: "FORWARD",
      reason: "HOT returned Training Approval Request to AM",
    },
    am_approve: {
      from: "AREA_MANAGER",
      to: "COMPANY",
      allowedRoles: ["AREA_MANAGER"],
      allowedStatuses: ["IN_REVIEW"],
      nextStatus: "APPROVED",
      action: "APPROVE",
      reason: "AM approved Training Approval Request",
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
