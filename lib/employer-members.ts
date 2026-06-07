import { createHash, randomBytes } from "node:crypto";

import { writeAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/rbac";

const employerRoles = ["EMPLOYER_ADMIN", "EMPLOYER_SUBMITTER", "EMPLOYER_VIEWER"] as const;
export type EmployerRole = (typeof employerRoles)[number];

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function assertEmployerRole(role: Role): asserts role is EmployerRole {
  if (!employerRoles.includes(role as EmployerRole)) {
    throw new Error("Unsupported employer role.");
  }
}

async function getEmployerAdminContext(requesterEmail: string) {
  const user = await getDb().user.findUnique({
    where: { email: requesterEmail.toLowerCase() },
    select: {
      id: true,
      email: true,
      memberships: {
        where: {
          role: "EMPLOYER_ADMIN",
          isActive: true,
          organizationId: { not: null },
          organization: { organizationType: "EMPLOYER", isActive: true },
        },
        select: {
          workspaceId: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!user || user.memberships.length !== 1 || !user.memberships[0].organizationId) {
    throw new Error(
      user?.memberships.length
        ? "Select one active employer organization before managing its users."
        : "An active employer administrator membership is required.",
    );
  }

  return {
    userId: user.id,
    email: user.email,
    workspaceId: user.memberships[0].workspaceId,
    organizationId: user.memberships[0].organizationId,
    organizationName: user.memberships[0].organization?.name ?? "Employer organization",
  };
}

export function getEmployerRoles() {
  return employerRoles;
}

export async function listEmployerMemberManagementData(requesterEmail: string) {
  const context = await getEmployerAdminContext(requesterEmail);
  const db = getDb();
  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: {
        organizationId: context.organizationId,
        role: { in: [...employerRoles] },
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        activatedAt: true,
        deactivatedAt: true,
        deactivatedReason: true,
        user: {
          select: { id: true, name: true, email: true, phoneNumber: true, isActive: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { user: { name: "asc" } }],
    }),
    db.organizationInvitation.findMany({
      where: {
        organizationId: context.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { organizationName: context.organizationName, members, invitations };
}

export async function inviteEmployerMember(input: {
  requesterEmail: string;
  email: string;
  role: Role;
}) {
  assertEmployerRole(input.role);
  const context = await getEmployerAdminContext(input.requesterEmail);
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({
    where: { email },
    select: {
      memberships: {
        where: { isActive: true },
        select: { organizationId: true, role: true },
      },
    },
  });

  if (
    existingUser?.memberships.some(
      (membership) => membership.organizationId === context.organizationId,
    )
  ) {
    throw new Error("This user already has active access to your organization.");
  }

  if (
    existingUser?.memberships.some(
      (membership) => !employerRoles.includes(membership.role as EmployerRole),
    )
  ) {
    throw new Error("This identity belongs to an ITF user and cannot be invited as an employer.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.organizationInvitation.updateMany({
    where: { organizationId: context.organizationId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const invitation = await db.organizationInvitation.create({
    data: {
      organizationId: context.organizationId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: context.userId,
      expiresAt,
    },
    select: { id: true },
  });

  await writeAuditEvent({
    action: "CREATE",
    actor: { id: context.userId, email: context.email, role: "EMPLOYER_ADMIN" },
    workspaceId: context.workspaceId,
    organizationId: context.organizationId,
    entityType: "OrganizationInvitation",
    entityId: invitation.id,
    reason: "Employer administrator invited an organization member.",
    metadata: { invitedEmail: email, invitedRole: input.role },
  });

  return { token, expiresAt };
}

export async function getOrganizationInvitation(token: string) {
  return getDb().organizationInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organization: { select: { name: true } },
    },
  });
}

export async function acceptOrganizationInvitation(input: {
  token: string;
  requesterEmail: string;
}) {
  const db = getDb();
  const invitation = await db.organizationInvitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organization: { select: { workspaceId: true } },
    },
  });

  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= new Date()
  ) {
    throw new Error("This organization invitation is invalid or has expired.");
  }
  if (invitation.email !== input.requesterEmail.toLowerCase()) {
    throw new Error("Sign in with the email address that received this invitation.");
  }
  assertEmployerRole(invitation.role);

  const user = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, isActive: true, emailVerifiedAt: true },
  });
  if (!user?.isActive || !user.emailVerifiedAt) {
    throw new Error("Verify and activate your portal account before accepting this invitation.");
  }

  await db.$transaction(async (tx) => {
    await tx.membership.updateMany({
      where: {
        userId: user.id,
        role: { in: [...employerRoles] },
        isActive: true,
        OR: [{ organizationId: invitation.organizationId }, { organizationId: null }],
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedReason: "Replaced when organization invitation was accepted.",
      },
    });

    await tx.membership.upsert({
      where: {
        userId_workspaceId_organizationId_role: {
          userId: user.id,
          workspaceId: invitation.organization.workspaceId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      },
      update: {
        isActive: true,
        activatedAt: new Date(),
        deactivatedAt: null,
        deactivatedById: null,
        deactivatedReason: null,
      },
      create: {
        userId: user.id,
        workspaceId: invitation.organization.workspaceId,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    });
  });
}

export async function revokeEmployerInvitation(input: {
  requesterEmail: string;
  invitationId: string;
}) {
  const context = await getEmployerAdminContext(input.requesterEmail);
  return getDb().organizationInvitation.updateMany({
    where: {
      id: input.invitationId,
      organizationId: context.organizationId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function changeEmployerMemberRole(input: {
  requesterEmail: string;
  membershipId: string;
  role: Role;
}) {
  assertEmployerRole(input.role);
  const context = await getEmployerAdminContext(input.requesterEmail);
  const db = getDb();
  const membership = await db.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId: context.organizationId,
      role: { in: [...employerRoles] },
      isActive: true,
    },
    select: { id: true, userId: true, role: true },
  });

  if (!membership) throw new Error("Active organization membership was not found.");
  if (membership.role === input.role) return;

  if (membership.role === "EMPLOYER_ADMIN") {
    const activeAdministratorCount = await db.membership.count({
      where: {
        organizationId: context.organizationId,
        role: "EMPLOYER_ADMIN",
        isActive: true,
      },
    });
    if (activeAdministratorCount <= 1) {
      throw new Error("Assign another active employer administrator before changing this role.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: context.userId,
        deactivatedReason: `Role changed to ${input.role}.`,
      },
    });

    await tx.membership.upsert({
      where: {
        userId_workspaceId_organizationId_role: {
          userId: membership.userId,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          role: input.role,
        },
      },
      update: {
        isActive: true,
        activatedAt: new Date(),
        deactivatedAt: null,
        deactivatedById: null,
        deactivatedReason: null,
      },
      create: {
        userId: membership.userId,
        workspaceId: context.workspaceId,
        organizationId: context.organizationId,
        role: input.role,
      },
    });
  });
}
