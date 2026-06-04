import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

const trainingMonitoringModes = ["LOCAL_PHYSICAL", "LOCAL_VIRTUAL"] as const;

export type TrainingMonitoringModeInput = (typeof trainingMonitoringModes)[number];

export type CreateTrainingMonitoringRecordInput = {
  trainingRequestId: string;
  requesterEmail: string;
  requesterRole: Role;
  mode: TrainingMonitoringModeInput;
};

export function getTrainingMonitoringModes() {
  return trainingMonitoringModes;
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

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
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
    actor.memberships.some(
      (membership) => membership.areaOfficeId === request.company.areaOfficeId,
    );

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to create monitoring for this Area Office request.");
  }

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
