import { getDb } from "@/lib/db";
import { writeAuditEvent } from "@/lib/audit";
import { can, type Role } from "@/lib/rbac";

export type DeactivateMembershipInput = {
  requesterEmail: string;
  requesterRole: Role;
  membershipId: string;
  reason: string;
};

export type ReactivateMembershipInput = {
  requesterEmail: string;
  requesterRole: Role;
  membershipId: string;
};

export async function deactivateMembership(input: DeactivateMembershipInput) {
  const db = getDb();
  const [requester, membership] = await Promise.all([
    db.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase() },
      select: {
        id: true,
        email: true,
        memberships: {
          where: { isActive: true },
          select: { organizationId: true, role: true },
        },
      },
    }),
    db.membership.findUnique({
      where: { id: input.membershipId },
      select: { id: true, userId: true, workspaceId: true, organizationId: true, role: true, isActive: true },
    }),
  ]);

  if (!requester || !membership) throw new Error("Membership was not found.");
  if (!membership.isActive) return membership;

  const workspaceManager = can(input.requesterRole, "workspace:manage");
  const employerAdministrator =
    membership.organizationId &&
    requester.memberships.some(
      (candidate) =>
        candidate.organizationId === membership.organizationId &&
        candidate.role === "EMPLOYER_ADMIN",
    );

  if (!workspaceManager && !employerAdministrator) {
    throw new Error("You do not have permission to deactivate this membership.");
  }

  if (membership.role === "EMPLOYER_ADMIN" && membership.organizationId) {
    const activeAdministratorCount = await db.membership.count({
      where: {
        organizationId: membership.organizationId,
        role: "EMPLOYER_ADMIN",
        isActive: true,
      },
    });

    if (activeAdministratorCount <= 1) {
      throw new Error("Assign another active employer administrator before removing this access.");
    }
  }

  const result = await db.membership.update({
    where: { id: membership.id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedById: requester.id,
      deactivatedReason: input.reason.trim(),
    },
    select: { id: true, isActive: true, deactivatedAt: true },
  });

  await writeAuditEvent({
    action: "UPDATE",
    actor: { id: requester.id, email: requester.email, role: input.requesterRole },
    workspaceId: membership.workspaceId,
    organizationId: membership.organizationId ?? undefined,
    entityType: "Membership",
    entityId: membership.id,
    reason: input.reason.trim(),
    metadata: { operation: "DEACTIVATE", memberUserId: membership.userId, memberRole: membership.role },
  });
  return result;
}

export async function reactivateMembership(input: ReactivateMembershipInput) {
  const db = getDb();
  const [requester, membership] = await Promise.all([
    db.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase() },
      select: {
        id: true,
        email: true,
        memberships: {
          where: { isActive: true },
          select: { organizationId: true, role: true },
        },
      },
    }),
    db.membership.findUnique({
      where: { id: input.membershipId },
      select: { id: true, userId: true, workspaceId: true, organizationId: true, role: true, isActive: true },
    }),
  ]);

  if (!requester || !membership) throw new Error("Membership was not found.");

  const workspaceManager = can(input.requesterRole, "workspace:manage");
  const employerAdministrator =
    membership.organizationId &&
    requester.memberships.some(
      (candidate) =>
        candidate.organizationId === membership.organizationId &&
        candidate.role === "EMPLOYER_ADMIN",
    );

  if (!workspaceManager && !employerAdministrator) {
    throw new Error("You do not have permission to reactivate this membership.");
  }

  const result = await db.membership.update({
    where: { id: membership.id },
    data: {
      isActive: true,
      activatedAt: new Date(),
      deactivatedAt: null,
      deactivatedById: null,
      deactivatedReason: null,
    },
    select: { id: true, isActive: true, activatedAt: true },
  });

  await writeAuditEvent({
    action: "UPDATE",
    actor: { id: requester.id, email: requester.email, role: input.requesterRole },
    workspaceId: membership.workspaceId,
    organizationId: membership.organizationId ?? undefined,
    entityType: "Membership",
    entityId: membership.id,
    reason: "Membership access reactivated.",
    metadata: { operation: "REACTIVATE", memberUserId: membership.userId, memberRole: membership.role },
  });
  return result;
}
