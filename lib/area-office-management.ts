import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

const areaOfficeOfficerRoles = [
  "AREA_MANAGER",
  "HORIC",
  "REVENUE_ACCOUNTANT",
  "HEAD_OF_TRAINING",
  "REIMBURSEMENT_OFFICER",
] as const satisfies readonly Role[];

export type AreaOfficeOfficerRole = (typeof areaOfficeOfficerRoles)[number];

export type AssignAreaOfficeOfficerInput = {
  requesterRole: Role;
  areaOfficeId: string;
  userId: string;
  role: AreaOfficeOfficerRole;
};

export type RemoveAreaOfficeOfficerInput = {
  requesterRole: Role;
  membershipId: string;
};

export type UpdateAreaOfficeStatusInput = {
  requesterRole: Role;
  areaOfficeId: string;
  isActive: boolean;
};

export function getAreaOfficeOfficerRoles() {
  return areaOfficeOfficerRoles;
}

export async function listAreaOfficeOfficerManagementData(input: { requesterRole: Role }) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage Area Office officers.");
  }

  const db = getDb();
  const [areaOffices, users] = await Promise.all([
    db.areaOffice.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        isActive: true,
        updatedAt: true,
        workspace: {
          select: {
            name: true,
          },
        },
        memberships: {
          where: {
            role: {
              in: [...areaOfficeOfficerRoles],
            },
          },
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        },
      },
    }),
    db.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    areaOffices,
    users,
  };
}

export async function assignAreaOfficeOfficer(input: AssignAreaOfficeOfficerInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to assign Area Office officers.");
  }

  if (!areaOfficeOfficerRoles.includes(input.role)) {
    throw new Error("Unsupported Area Office officer role.");
  }

  const db = getDb();
  const areaOffice = await db.areaOffice.findFirst({
    where: {
      id: input.areaOfficeId,
    },
    select: {
      id: true,
      workspaceId: true,
      workspace: {
        select: {
          organizations: {
            where: {
              organizationType: "ITF_INTERNAL",
              isActive: true,
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!areaOffice) {
    throw new Error("Area Office was not found.");
  }

  const organization = areaOffice.workspace.organizations[0];

  if (!organization) {
    throw new Error("ITF internal organization was not found for this workspace.");
  }

  const user = await db.user.findFirst({
    where: {
      id: input.userId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("Selected officer user was not found or is inactive.");
  }

  const membershipId = `${user.id}-${input.role.toLowerCase()}`;

  return db.membership.upsert({
    where: {
      userId_workspaceId_organizationId_role: {
        userId: user.id,
        workspaceId: areaOffice.workspaceId,
        organizationId: organization.id,
        role: input.role,
      },
    },
    update: {
      areaOfficeId: areaOffice.id,
    },
    create: {
      id: membershipId,
      userId: user.id,
      workspaceId: areaOffice.workspaceId,
      organizationId: organization.id,
      areaOfficeId: areaOffice.id,
      role: input.role,
    },
    select: {
      id: true,
    },
  });
}

export async function removeAreaOfficeOfficer(input: RemoveAreaOfficeOfficerInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to remove Area Office officers.");
  }

  return getDb().membership.delete({
    where: {
      id: input.membershipId,
    },
    select: {
      id: true,
    },
  });
}

export async function updateAreaOfficeStatus(input: UpdateAreaOfficeStatusInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to update Area Offices.");
  }

  return getDb().areaOffice.update({
    where: {
      id: input.areaOfficeId,
    },
    data: {
      isActive: input.isActive,
    },
    select: {
      id: true,
      isActive: true,
    },
  });
}
