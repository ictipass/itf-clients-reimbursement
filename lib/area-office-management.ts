import { getDb } from "@/lib/db";
import { deactivateMembership } from "@/lib/membership-lifecycle";
import { assertNoOpenAssignedWork } from "@/lib/open-assignment-guard";
import { can, type Role } from "@/lib/rbac";

const areaOfficeOfficerRoles = [
  "AREA_MANAGER",
  "HORIC",
  "REVENUE_ACCOUNTANT",
  "HEAD_OF_TRAINING",
  "REIMBURSEMENT_OFFICER",
] as const satisfies readonly Role[];

const headquartersOfficerRoles = [
  "SYSTEM_ADMIN",
  "WORKSPACE_APP_ADMIN",
  "ITF_AUDITOR",
  "DIRECTOR_FSD",
  "HEAD_OF_DIVISION",
  "HQ_REIMBURSEMENT_OFFICER",
  "HQ_REVENUE_ACCOUNTANT",
  "DIRECTOR_GENERAL",
  "DIRECTOR_AUDIT",
  "HEAD_REIMBURSEMENT_AUDIT",
  "REIMBURSEMENT_SCHEDULE_AUDITOR",
  "DIRECTOR_FINANCE",
  "HEAD_ACCOUNTS",
  "HEAD_REIMBURSEMENT_FINANCE",
  "REIMBURSEMENT_ACCOUNTANT",
  "HEAD_BUDGET",
  "BUDGET_OFFICER",
  "HEAD_PRE_AUDIT",
  "PRE_AUDIT_OFFICER",
  "HEAD_EXPENDITURE",
  "EXPENDITURE_ACCOUNTANT",
  "PAYMENT_INITIATOR",
  "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE",
  "HEAD_INSPECTORATE_COMPLIANCE",
  "ITF_REGISTRATION_OFFICER",
  "ITF_COMPLIANCE_OFFICER",
  "ITF_TRAINING_APPROVER",
  "ITF_CLAIMS_REVIEWER",
  "ITF_CLAIMS_APPROVER",
] as const satisfies readonly Role[];

export type AreaOfficeOfficerRole = (typeof areaOfficeOfficerRoles)[number];
export type HeadquartersOfficerRole = (typeof headquartersOfficerRoles)[number];
export type OfficeOfficerRole = AreaOfficeOfficerRole | HeadquartersOfficerRole;
export type OfficeScope = "AREA_OFFICE" | "HEADQUARTERS";

export type AssignOfficeOfficerInput = {
  requesterRole: Role;
  officeScope: OfficeScope;
  areaOfficeId?: string;
  userId: string;
  role: OfficeOfficerRole;
};

export type RemoveOfficeOfficerInput = {
  requesterEmail: string;
  requesterRole: Role;
  membershipId: string;
};

export type UpdateAreaOfficeStatusInput = {
  requesterRole: Role;
  areaOfficeId: string;
  isActive: boolean;
};

export type CreateAreaOfficeInput = {
  requesterRole: Role;
  name: string;
  code?: string;
  slug?: string;
};

export function getAreaOfficeOfficerRoles() {
  return areaOfficeOfficerRoles;
}

export function getHeadquartersOfficerRoles() {
  return headquartersOfficerRoles;
}

export async function listOfficeManagementData(input: {
  requesterRole: Role;
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage office officers.");
  }

  const db = getDb();
  const query = input.query?.trim();
  const pageSize = Math.min(Math.max(input.pageSize ?? 12, 5), 50);
  const requestedPage = Math.max(input.page ?? 1, 1);
  const areaOfficeWhere = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
          { code: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const totalAreaOffices = await db.areaOffice.count({ where: areaOfficeWhere });
  const totalPages = Math.max(Math.ceil(totalAreaOffices / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const headquarters = await ensureHeadquarters();
  const [itfOrganization, areaOffices, users] = await Promise.all([
    db.organization.findFirst({
      where: {
        id: headquarters.organizationId,
        organizationType: "ITF_INTERNAL",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        workspace: {
          select: {
            name: true,
          },
        },
        memberships: {
          where: {
            areaOfficeId: null,
            isActive: true,
            role: {
              in: [...headquartersOfficerRoles],
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
                staffNumber: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        },
      },
    }),
    db.areaOffice.findMany({
      where: areaOfficeWhere,
      skip: (page - 1) * pageSize,
      take: pageSize,
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
            isActive: true,
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
                staffNumber: true,
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
        staffNumber: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    headquarters: itfOrganization,
    areaOffices,
    users,
    totalAreaOffices,
    page,
    pageSize,
    totalPages,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getDefaultWorkspace() {
  const workspace = await getDb().workspace.findFirst({
    where: {
      isActive: true,
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!workspace) {
    throw new Error("No active workspace was found.");
  }

  return workspace;
}

async function ensureHeadquarters() {
  const db = getDb();
  const existing = await db.organization.findFirst({
    where: {
      organizationType: "ITF_INTERNAL",
      isActive: true,
    },
    select: {
      id: true,
      workspaceId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existing) {
    return {
      workspaceId: existing.workspaceId,
      organizationId: existing.id,
      areaOfficeId: null,
    };
  }

  const workspace = await getDefaultWorkspace();
  const organization = await db.organization.upsert({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug: "itf",
      },
    },
    update: {
      name: "Industrial Training Fund",
      organizationType: "ITF_INTERNAL",
      isActive: true,
    },
    create: {
      workspaceId: workspace.id,
      name: "Industrial Training Fund",
      slug: "itf",
      organizationType: "ITF_INTERNAL",
    },
    select: {
      id: true,
      workspaceId: true,
    },
  });

  return {
    workspaceId: organization.workspaceId,
    organizationId: organization.id,
    areaOfficeId: null,
  };
}

export async function assignOfficeOfficer(input: AssignOfficeOfficerInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to assign office officers.");
  }

  if (
    input.officeScope === "AREA_OFFICE" &&
    !areaOfficeOfficerRoles.includes(input.role as AreaOfficeOfficerRole)
  ) {
    throw new Error("Unsupported Area Office officer role.");
  }

  if (
    input.officeScope === "HEADQUARTERS" &&
    !headquartersOfficerRoles.includes(input.role as HeadquartersOfficerRole)
  ) {
    throw new Error("Unsupported Headquarters officer role.");
  }

  const db = getDb();

  const office =
    input.officeScope === "AREA_OFFICE"
      ? await resolveAreaOffice(input.areaOfficeId)
      : await resolveHeadquarters();

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

  const membershipScope = office.areaOfficeId ?? office.organizationId ?? office.workspaceId;
  const membershipId = `${user.id}-${input.role.toLowerCase()}-${membershipScope}`;

  return db.$transaction(async (tx) => {
    const existingAssignment = await tx.membership.findUnique({
      where: { userId_workspaceId_organizationId_role: {
        userId: user.id, workspaceId: office.workspaceId, organizationId: office.organizationId, role: input.role,
      } },
      select: { isActive: true, areaOfficeId: true },
    });
    if (existingAssignment?.isActive && existingAssignment.areaOfficeId !== office.areaOfficeId) {
      await assertNoOpenAssignedWork({
        userId: user.id, role: input.role, workspaceId: office.workspaceId,
        areaOfficeId: existingAssignment.areaOfficeId ?? undefined, db: tx,
      });
    }

    return tx.membership.upsert({
      where: {
        userId_workspaceId_organizationId_role: {
          userId: user.id,
          workspaceId: office.workspaceId,
          organizationId: office.organizationId,
          role: input.role,
        },
      },
      update: {
        areaOfficeId: office.areaOfficeId,
        isActive: true,
        activatedAt: new Date(),
        deactivatedAt: null,
        deactivatedById: null,
        deactivatedReason: null,
      },
      create: {
        id: membershipId,
        userId: user.id,
        workspaceId: office.workspaceId,
        organizationId: office.organizationId,
        areaOfficeId: office.areaOfficeId,
        role: input.role,
      },
      select: { id: true },
    });
  });
}

async function resolveAreaOffice(areaOfficeId: string | undefined) {
  if (!areaOfficeId) {
    throw new Error("Area Office is required for Area Office assignments.");
  }

  const db = getDb();
  const headquarters = await ensureHeadquarters();
  const areaOffice = await db.areaOffice.findFirst({
    where: {
      id: areaOfficeId,
    },
    select: {
      id: true,
      workspaceId: true,
      workspace: {
        select: {
          organizations: {
            where: {
              id: headquarters.organizationId,
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

  return {
    workspaceId: areaOffice.workspaceId,
    organizationId: organization.id,
    areaOfficeId: areaOffice.id,
  };
}

async function resolveHeadquarters() {
  return ensureHeadquarters();
}

export async function createAreaOffice(input: CreateAreaOfficeInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to create Area Offices.");
  }

  const name = input.name.trim().replace(/\s+/g, " ");
  const code = input.code?.trim() || undefined;
  const slug = slugify(input.slug || name);

  if (name.length < 2) {
    throw new Error("Area Office name must contain at least two characters.");
  }

  if (!slug) {
    throw new Error("Area Office slug could not be generated.");
  }

  const workspace = await getDefaultWorkspace();

  return getDb().areaOffice.upsert({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug,
      },
    },
    update: {
      name,
      code,
      isActive: true,
    },
    create: {
      workspaceId: workspace.id,
      name,
      slug,
      code,
    },
    select: {
      id: true,
    },
  });
}

export async function removeOfficeOfficer(input: RemoveOfficeOfficerInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to remove office officers.");
  }

  return deactivateMembership({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    membershipId: input.membershipId,
    reason: "Officer assignment removed from office management.",
  });
}

export async function updateAreaOfficeStatus(input: UpdateAreaOfficeStatusInput) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to update Area Offices.");
  }

  const db = getDb();
  return db.$transaction(async (tx) => {
    if (!input.isActive) {
      const item = await tx.workItem.findFirst({
        where: { areaOfficeId: input.areaOfficeId, status: "OPEN", assignedUserId: { not: null } },
        select: { title: true, targetHref: true },
      });
      if (item) throw new Error(`This Area Office has an open assigned job (${item.title}). Reassign or complete it at ${item.targetHref} before deactivating the office.`);
    }
    return tx.areaOffice.update({
      where: { id: input.areaOfficeId },
      data: { isActive: input.isActive },
      select: { id: true, isActive: true },
    });
  });
}
