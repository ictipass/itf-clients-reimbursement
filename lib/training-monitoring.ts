import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const trainingMonitoringModes = ["LOCAL_PHYSICAL", "LOCAL_VIRTUAL"] as const;
const trainingMonitoringEvidenceKinds = [
  "ATTENDANCE_SHEET",
  "TRAINING_REPORT",
  "TRAINING_PHOTO",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

export type TrainingMonitoringModeInput = (typeof trainingMonitoringModes)[number];
export type TrainingMonitoringEvidenceKind = (typeof trainingMonitoringEvidenceKinds)[number];

export type CreateTrainingMonitoringRecordInput = {
  trainingRequestId: string;
  requesterEmail: string;
  requesterRole: Role;
  mode: TrainingMonitoringModeInput;
};

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

export function getTrainingMonitoringModes() {
  return trainingMonitoringModes;
}

export function getTrainingMonitoringEvidenceKinds() {
  return trainingMonitoringEvidenceKinds;
}

export async function createTrainingMonitoringRecord(
  input: CreateTrainingMonitoringRecordInput,
) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to create Training Monitoring records.");
  }

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.trainingRequestId,
      status: "APPROVED",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      company: {
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Monitoring records can only be created from approved Training Approval Requests.");
  }

  await assertTrainingMonitoringAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: request.company.areaOfficeId,
  });

  return db.trainingMonitoringRecord.create({
    data: {
      trainingRequestId: request.id,
      mode: input.mode,
      monitoringDate: request.startsAt,
      startsAt: request.startsAt,
      endsAt: request.endsAt,
      status: "DRAFT",
    },
    select: {
      id: true,
    },
  });
}

export async function uploadTrainingMonitoringEvidence(
  input: UploadTrainingMonitoringEvidenceInput,
) {
  if (!can(input.requesterRole, "training:approve")) {
    throw new Error("You do not have permission to upload Training Monitoring evidence.");
  }

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

async function findEditableMonitoringRecord(recordId: string) {
  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: recordId,
      recordTier: "HOT",
      status: {
        in: ["DRAFT", "IN_REVIEW", "SUBMITTED"],
      },
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
