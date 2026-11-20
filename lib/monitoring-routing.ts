import type { Prisma, Role, TrainingDeliveryMode, TrainingMonitoringMode } from "@/lib/generated/prisma/client";

export const monitoringHeadquartersRoles: readonly Role[] = [
  "HQ_REIMBURSEMENT_OFFICER",
  "HEAD_OF_DIVISION",
  "DIRECTOR_FSD",
];

export const monitoringAreaRoles: readonly Role[] = [
  "REIMBURSEMENT_OFFICER",
  "HEAD_OF_TRAINING",
  "AREA_MANAGER",
];

export function isMonitoringHeadquartersRole(role: Role) {
  return monitoringHeadquartersRoles.includes(role);
}

export function isMonitoringAreaRole(role: Role) {
  return monitoringAreaRoles.includes(role);
}

export function getMonitoringInitialAssignment(deliveryMode: TrainingDeliveryMode) {
  return deliveryMode === "LOCAL_ONLINE"
    ? {
        mode: "LOCAL_VIRTUAL" as const,
        desk: "HQ_REIMBURSEMENT_OFFICER" as const,
        role: "HEAD_OF_DIVISION" as const,
        sourceSuffix: "hq-assignment",
      }
    : {
        mode: "LOCAL_PHYSICAL" as const,
        desk: "REIMBURSEMENT_OFFICER" as const,
        role: "REIMBURSEMENT_OFFICER" as const,
        sourceSuffix: "reimbursement-officer",
      };
}

export function canMonitorAtDesk(role: Role, mode: TrainingMonitoringMode, desk: string) {
  if (role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN") return true;
  if (mode === "LOCAL_VIRTUAL") {
    return (
      (desk === "HQ_REIMBURSEMENT_OFFICER" && role === "HQ_REIMBURSEMENT_OFFICER") ||
      (desk === "HEAD_OF_DIVISION" && role === "HEAD_OF_DIVISION") ||
      (desk === "DIRECTOR_FSD" && role === "DIRECTOR_FSD")
    );
  }
  return (
    (desk === "REIMBURSEMENT_OFFICER" && role === "REIMBURSEMENT_OFFICER") ||
    (desk === "HEAD_OF_TRAINING" && role === "HEAD_OF_TRAINING") ||
    (desk === "AREA_MANAGER" && role === "AREA_MANAGER")
  );
}

export function monitoringVisibilityWhere(
  role: Role,
  memberships: readonly { role: Role; workspaceId: string; organizationId: string | null; areaOfficeId: string | null }[],
  requesterId?: string | null,
): Prisma.TrainingMonitoringRecordWhereInput {
  if (role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN") return {};
  const active = memberships.filter((membership) => membership.role === role);
  if (isMonitoringHeadquartersRole(role)) {
    const workspaceIds = active.filter((membership) => !membership.areaOfficeId).map((membership) => membership.workspaceId);
    if (!workspaceIds.length || (role === "HQ_REIMBURSEMENT_OFFICER" && !requesterId)) {
      return { id: "__no_monitoring_access__" };
    }
    return {
      mode: "LOCAL_VIRTUAL",
      trainingRequest: { company: { organization: { workspaceId: { in: workspaceIds } } } },
      ...(role === "HQ_REIMBURSEMENT_OFFICER" ? {
        OR: [
          {
            currentDesk: "HQ_REIMBURSEMENT_OFFICER",
            workItems: { some: {
              app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN",
              assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: requesterId,
            } },
          },
          {
            currentDesk: { not: "HQ_REIMBURSEMENT_OFFICER" },
            workItems: { some: {
              app: "REIMBURSEMENT", recordTier: "HOT",
              assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: requesterId,
            } },
          },
        ],
      } : {}),
    };
  }
  if (isMonitoringAreaRole(role)) {
    const ids = active.map((membership) => membership.areaOfficeId).filter((id): id is string => Boolean(id));
    return {
      mode: "LOCAL_PHYSICAL",
      trainingRequest: { company: { areaOfficeId: { in: ids } } },
    };
  }
  if (role.startsWith("EMPLOYER_")) {
    const ids = active.map((membership) => membership.organizationId).filter((id): id is string => Boolean(id));
    return { trainingRequest: { company: { organizationId: { in: ids } } } };
  }
  return { id: "__no_monitoring_access__" };
}
