import { writeAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

const employerRoles = ["EMPLOYER_ADMIN", "EMPLOYER_SUBMITTER", "EMPLOYER_VIEWER"] as const;

function assertWorkspaceManager(role: Role) {
  if (!can(role, "workspace:manage")) {
    throw new Error("You do not have permission to manage employer access.");
  }
}

export async function listEmployerAccessAdministration(input: {
  requesterRole: Role;
  query?: string;
}) {
  assertWorkspaceManager(input.requesterRole);
  const query = input.query?.trim();

  return getDb().organization.findMany({
    where: {
      organizationType: "EMPLOYER",
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { companies: { some: { legalName: { contains: query, mode: "insensitive" } } } },
              {
                memberships: {
                  some: { user: { email: { contains: query, mode: "insensitive" } } },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      companies: {
        select: { id: true, legalName: true, itfEmployerNumber: true },
        orderBy: { legalName: "asc" },
      },
      memberships: {
        where: { role: { in: [...employerRoles] } },
        select: {
          id: true,
          role: true,
          isActive: true,
          activatedAt: true,
          deactivatedAt: true,
          deactivatedReason: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              emailVerifiedAt: true,
            },
          },
        },
        orderBy: [{ isActive: "desc" }, { role: "asc" }, { user: { name: "asc" } }],
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });
}

export async function replaceEmployerAdministrators(input: {
  requesterEmail: string;
  requesterRole: Role;
  organizationId: string;
  replacementEmail: string;
  reason: string;
}) {
  assertWorkspaceManager(input.requesterRole);
  const reason = input.reason.trim();
  const replacementEmail = input.replacementEmail.trim().toLowerCase();

  if (!reason) throw new Error("A reason is required for an emergency access replacement.");
  if (!replacementEmail) throw new Error("Enter the replacement administrator's email address.");

  const db = getDb();
  const [requester, organization, replacement] = await Promise.all([
    db.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase() },
      select: { id: true, email: true },
    }),
    db.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, name: true, workspaceId: true, organizationType: true },
    }),
    db.user.findUnique({
      where: { email: replacementEmail },
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
        memberships: {
          where: { isActive: true },
          select: { role: true },
        },
      },
    }),
  ]);

  if (!requester) throw new Error("The requesting administrator was not found.");
  if (!organization || organization.organizationType !== "EMPLOYER") {
    throw new Error("The selected employer organization was not found.");
  }
  if (!replacement?.isActive || !replacement.emailVerifiedAt) {
    throw new Error("The replacement must have an active, verified portal account.");
  }
  if (
    replacement.memberships.some(
      (membership) => !employerRoles.includes(membership.role as (typeof employerRoles)[number]),
    )
  ) {
    throw new Error("An ITF staff identity cannot be assigned as an employer administrator.");
  }

  const changedAt = new Date();
  const result = await db.$transaction(async (tx) => {
    const previousAdministrators = await tx.membership.findMany({
      where: {
        organizationId: organization.id,
        role: "EMPLOYER_ADMIN",
        isActive: true,
        userId: { not: replacement.id },
      },
      select: { id: true, userId: true },
    });

    await tx.membership.updateMany({
      where: { id: { in: previousAdministrators.map((membership) => membership.id) } },
      data: {
        isActive: false,
        deactivatedAt: changedAt,
        deactivatedById: requester.id,
        deactivatedReason: reason,
      },
    });

    const membership = await tx.membership.upsert({
      where: {
        userId_workspaceId_organizationId_role: {
          userId: replacement.id,
          workspaceId: organization.workspaceId,
          organizationId: organization.id,
          role: "EMPLOYER_ADMIN",
        },
      },
      update: {
        isActive: true,
        activatedAt: changedAt,
        deactivatedAt: null,
        deactivatedById: null,
        deactivatedReason: null,
      },
      create: {
        userId: replacement.id,
        workspaceId: organization.workspaceId,
        organizationId: organization.id,
        role: "EMPLOYER_ADMIN",
        activatedAt: changedAt,
      },
      select: { id: true },
    });

    return { membershipId: membership.id, removedCount: previousAdministrators.length };
  });

  await writeAuditEvent({
    action: "UPDATE",
    actor: { id: requester.id, email: requester.email, role: input.requesterRole },
    workspaceId: organization.workspaceId,
    organizationId: organization.id,
    entityType: "EmployerAdministratorAccess",
    entityId: result.membershipId,
    reason,
    metadata: {
      replacementEmail,
      previousAdministratorsDeactivated: result.removedCount,
    },
  });

  return result;
}
