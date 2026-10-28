import { Prisma, type Role } from "@/lib/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isIndividuallyAssignedClaimRole } from "@/lib/claim-officer-assignment";

const pageSize = 20;
const areaRoles = new Set<Role>(["AREA_MANAGER", "HORIC", "REVENUE_ACCOUNTANT", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"]);

export function hasValidAssignment(input: {
  userActive: boolean;
  role: Role | null;
  workspaceId: string;
  organizationId: string | null;
  areaOfficeId: string | null;
  memberships: { isActive: boolean; role: Role; workspaceId: string; organizationId: string | null; areaOfficeId: string | null }[];
}) {
  if (!input.userActive || !input.role) return false;
  return input.memberships.some((membership) =>
    membership.isActive && membership.role === input.role && membership.workspaceId === input.workspaceId &&
    (areaRoles.has(input.role!) ? Boolean(input.areaOfficeId) && membership.areaOfficeId === input.areaOfficeId
      : input.role.startsWith("EMPLOYER_") ? Boolean(input.organizationId) && membership.organizationId === input.organizationId
        : true));
}

export async function getRecoveryAdmin(email: string, role: Role) {
  if (role !== "SYSTEM_ADMIN" && role !== "WORKSPACE_APP_ADMIN") return null;
  return getDb().user.findFirst({
    where: { email, isActive: true, memberships: { some: { isActive: true, role } } },
    select: {
      id: true,
      memberships: { where: { isActive: true, role }, select: { workspaceId: true } },
    },
  });
}

export async function listStrandedAssignments(workspaceIds: string[], requestedPage: number) {
  if (!workspaceIds.length) return { items: [], total: 0, page: 1, pageSize };
  const db = getDb();
  const where = Prisma.sql`
    w."workspaceId" IN (${Prisma.join(workspaceIds)})
    AND w."app" = 'REIMBURSEMENT' AND w."recordTier" = 'HOT' AND w."status" = 'OPEN'
    AND w."assignedUserId" IS NOT NULL AND w."assignedRole" IS NOT NULL
    AND (NOT u."isActive" OR NOT EXISTS (
      SELECT 1 FROM "Membership" m
      WHERE m."userId" = w."assignedUserId" AND m."isActive" = true
        AND m."workspaceId" = w."workspaceId" AND m."role" = w."assignedRole"
        AND CASE
          WHEN w."assignedRole"::text IN ('AREA_MANAGER', 'HORIC', 'REVENUE_ACCOUNTANT', 'HEAD_OF_TRAINING', 'REIMBURSEMENT_OFFICER')
            THEN w."areaOfficeId" IS NOT NULL AND m."areaOfficeId" = w."areaOfficeId"
          WHEN left(w."assignedRole"::text, 9) = 'EMPLOYER_'
            THEN w."organizationId" IS NOT NULL AND m."organizationId" = w."organizationId"
          ELSE true
        END
    ))`;
  const count = await db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total FROM "WorkItem" w JOIN "User" u ON u."id" = w."assignedUserId" WHERE ${where}`);
  const total = Number(count[0]?.total ?? 0);
  const page = Math.min(Math.max(Math.floor(requestedPage) || 1, 1), Math.max(Math.ceil(total / pageSize), 1));
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT w."id" FROM "WorkItem" w JOIN "User" u ON u."id" = w."assignedUserId"
    WHERE ${where} ORDER BY w."createdAt" DESC, w."id" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
  const found = await db.workItem.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: {
      id: true, title: true, targetHref: true, sourceKey: true, assignedRole: true,
      workspaceId: true, organizationId: true, areaOfficeId: true, assignedUserId: true,
      trainingPlanSubmissionId: true, reimbursementClaimId: true, createdAt: true,
      areaOffice: { select: { name: true } }, company: { select: { legalName: true } },
      assignedUser: { select: { name: true, email: true, isActive: true } },
    },
  });
  const byId = new Map(found.map((item) => [item.id, item]));
  return { items: rows.flatMap((row) => byId.get(row.id) ? [byId.get(row.id)!] : []), total, page, pageSize };
}

export function recoveryTarget(item: { assignedRole: Role | null; trainingPlanSubmissionId: string | null; reimbursementClaimId: string | null; sourceKey: string }) {
  if (item.trainingPlanSubmissionId && item.assignedRole === "REIMBURSEMENT_OFFICER") return { kind: "plan" as const, id: item.trainingPlanSubmissionId };
  if (item.reimbursementClaimId && item.assignedRole && isIndividuallyAssignedClaimRole(item.assignedRole)) return { kind: "claim" as const, id: item.reimbursementClaimId };
  const match = /^training-request:([^:]+):reimbursement_officer$/.exec(item.sourceKey);
  if (match && item.assignedRole === "REIMBURSEMENT_OFFICER") return { kind: "request" as const, id: match[1] };
  return null;
}

export async function listRecoveryOfficers(items: Awaited<ReturnType<typeof listStrandedAssignments>>["items"]) {
  const db = getDb();
  const roles = items.flatMap((item) => item.assignedRole ? [item.assignedRole] : []);
  const workspaceIds = [...new Set(items.map((item) => item.workspaceId))];
  if (!roles.length || !workspaceIds.length) return new Map<string, { id: string; name: string; email: string }[]>();
  const users = await db.user.findMany({
    where: { isActive: true, memberships: { some: { isActive: true, role: { in: roles }, workspaceId: { in: workspaceIds } } } },
    select: {
      id: true, name: true, email: true,
      memberships: { where: { isActive: true, role: { in: roles }, workspaceId: { in: workspaceIds } }, select: { isActive: true, role: true, workspaceId: true, organizationId: true, areaOfficeId: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return new Map(items.map((item) => [item.id, users.filter((user) =>
    user.id !== item.assignedUserId && hasValidAssignment({
      userActive: true, role: item.assignedRole, workspaceId: item.workspaceId,
      organizationId: item.organizationId, areaOfficeId: item.areaOfficeId, memberships: user.memberships,
    })).map(({ id, name, email }) => ({ id, name, email }))]));
}
