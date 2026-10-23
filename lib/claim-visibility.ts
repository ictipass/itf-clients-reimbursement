import type { Prisma } from "@/lib/generated/prisma/client";

import { getDb } from "@/lib/db";
import { isItfRole, type Role } from "@/lib/rbac";

type ClaimViewer = { email: string | null | undefined; role: Role };
type ActiveMembership = { role: Role; workspaceId: string; organizationId: string | null; areaOfficeId: string | null };

const noClaims: Prisma.ReimbursementClaimWhereInput = { id: { in: [] } };

const areaOfficeRoles: Role[] = ["AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"];

/** The packet becomes visible to an officer when a workflow work item is first assigned to that desk. */
export async function getClaimVisibilityWhere(viewer: ClaimViewer): Promise<Prisma.ReimbursementClaimWhereInput> {
  if (!viewer.email) return noClaims;

  const user = await getDb().user.findUnique({
    where: { email: viewer.email },
    select: {
      isActive: true,
      memberships: {
        where: { isActive: true },
        select: { role: true, workspaceId: true, organizationId: true, areaOfficeId: true },
      },
    },
  });
  if (!user?.isActive) return noClaims;

  return buildClaimVisibilityWhere(viewer.role, user.memberships);
}

export function buildClaimVisibilityWhere(role: Role, activeMemberships: ActiveMembership[]): Prisma.ReimbursementClaimWhereInput {
  const memberships = activeMemberships.filter((membership) => membership.role === role);
  if (!memberships.length) return noClaims;

  if (role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN") {
    return { company: { organization: { workspaceId: { in: memberships.map((membership) => membership.workspaceId) } } } };
  }

  if (!isItfRole(role)) {
    const organizationIds = memberships.flatMap((membership) => membership.organizationId ? [membership.organizationId] : []);
    return organizationIds.length ? { company: { organizationId: { in: organizationIds } } } : noClaims;
  }

  const workspaceIds = memberships.map((membership) => membership.workspaceId);
  const officeIds = memberships.flatMap((membership) => membership.areaOfficeId ? [membership.areaOfficeId] : []);
  if (areaOfficeRoles.includes(role) && !officeIds.length) return noClaims;

  return {
    company: {
      organization: { workspaceId: { in: workspaceIds } },
      ...(areaOfficeRoles.includes(role) ? { areaOfficeId: { in: officeIds } } : {}),
    },
    workItems: { some: { assignedRole: role, app: "REIMBURSEMENT", recordTier: "HOT" } },
  };
}
