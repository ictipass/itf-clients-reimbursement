import { getDb } from "@/lib/db";
import type { Role } from "@/lib/rbac";

const globalTrainingPlanRoles: Role[] = [
  "SYSTEM_ADMIN",
  "WORKSPACE_APP_ADMIN",
  "ITF_TRAINING_APPROVER",
  "ITF_AUDITOR",
  "DIRECTOR_FSD",
  "HEAD_OF_DIVISION",
  "HQ_REIMBURSEMENT_OFFICER",
  "HQ_REVENUE_ACCOUNTANT",
  "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE",
  "HEAD_INSPECTORATE_COMPLIANCE",
];

export async function getItfTrainingPlanCompanyWhere(email: string, role: Role) {
  if (globalTrainingPlanRoles.includes(role)) {
    const membership = await getDb().membership.findFirst({
      where: { user: { email: email.toLowerCase(), isActive: true }, isActive: true, role },
      select: { id: true },
    });
    return membership ? {} : { id: "__no_company_scope__" };
  }

  const memberships = await getDb().membership.findMany({
    where: {
      user: {
        email: email.toLowerCase(),
        isActive: true,
      },
      isActive: true,
      role,
    },
    select: {
      areaOfficeId: true,
    },
  });
  const areaOfficeIds = Array.from(
    new Set(
      memberships
        .map((membership) => membership.areaOfficeId)
        .filter((areaOfficeId): areaOfficeId is string => Boolean(areaOfficeId)),
    ),
  );

  return areaOfficeIds.length > 0
    ? {
        areaOfficeId: {
          in: areaOfficeIds,
        },
      }
    : {
        areaOfficeId: "__no_area_office_scope__",
      };
}
