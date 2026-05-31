import { getDb } from "@/lib/db";
import { type Role } from "@/lib/rbac";

export type AttentionSummaryInput = {
  requesterEmail?: string | null;
  requesterRole: Role;
  take?: number;
};

export async function getAttentionSummary(input: AttentionSummaryInput) {
  const db = getDb();

  const requester = input.requesterEmail
    ? await db.user.findUnique({
        where: {
          email: input.requesterEmail,
        },
        select: {
          id: true,
          memberships: {
            select: {
              organizationId: true,
              areaOfficeId: true,
              role: true,
            },
          },
        },
      })
    : null;

  const baseWhere = {
    app: "REIMBURSEMENT" as const,
    status: "OPEN" as const,
    recordTier: "HOT" as const,
  };

  const canSeeAll =
    input.requesterRole === "SYSTEM_ADMIN" || input.requesterRole === "WORKSPACE_APP_ADMIN";

  const scopedWhere = canSeeAll
    ? baseWhere
    : {
        ...baseWhere,
        OR: buildAssigneeScope(input.requesterRole, requester),
      };

  const [workItemTotal, workItems] = await db.$transaction([
    db.workItem.count({
      where: scopedWhere,
    }),
    db.workItem.findMany({
      where: scopedWhere,
      select: {
        id: true,
        kind: true,
        priority: true,
        assignedRole: true,
        title: true,
        summary: true,
        targetHref: true,
        createdAt: true,
        registrationApplicationId: true,
        company: {
          select: {
            legalName: true,
          },
        },
        areaOffice: {
          select: {
            name: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: input.take ?? 5,
    }),
  ]);
  const derivedItems = await getDerivedRegistrationDeskItems({
    requesterRole: input.requesterRole,
    requester,
    excludedRegistrationApplicationIds: workItems
      .map((item) => item.registrationApplicationId)
      .filter((value): value is string => Boolean(value)),
    take: input.take ?? 5,
  });
  const items = [...workItems, ...derivedItems]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, input.take ?? 5);

  return {
    total: workItemTotal + derivedItems.length,
    items,
  };
}

async function getDerivedRegistrationDeskItems(input: {
  requesterRole: Role;
  requester: {
    memberships: {
      areaOfficeId: string | null;
    }[];
  } | null;
  excludedRegistrationApplicationIds: string[];
  take: number;
}) {
  if (
    input.requesterRole !== "AREA_MANAGER" &&
    input.requesterRole !== "HORIC" &&
    input.requesterRole !== "REVENUE_ACCOUNTANT"
  ) {
    return [];
  }

  const areaOfficeIds = uniqueDefined(
    input.requester?.memberships.map((membership) => membership.areaOfficeId) ?? [],
  );

  if (areaOfficeIds.length === 0) {
    return [];
  }

  const registrations = await getDb().registrationApplication.findMany({
    where: {
      id: {
        notIn: input.excludedRegistrationApplicationIds,
      },
      currentDesk: input.requesterRole,
      status: "SUBMITTED",
      recordTier: "HOT",
      areaOfficeId: {
        in: areaOfficeIds,
      },
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      createdAt: true,
      companyId: true,
      currentDesk: true,
      company: {
        select: {
          legalName: true,
        },
      },
      areaOffice: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: input.take,
  });

  return registrations.map((registration) => ({
    id: `derived-registration-${registration.id}`,
    kind:
      registration.currentDesk === "AREA_MANAGER"
        ? ("REGISTRATION_AREA_MANAGER_REVIEW" as const)
        : ("REGISTRATION_AREA_OFFICE_REVIEW" as const),
    priority: "NORMAL" as const,
    assignedRole: input.requesterRole,
    title: getDerivedRegistrationTitle(input.requesterRole),
    summary: `${registration.company.legalName} is awaiting ${input.requesterRole.replaceAll("_", " ")} action.`,
    targetHref: `/registry/${registration.companyId}`,
    createdAt: registration.createdAt,
    registrationApplicationId: registration.id,
    company: {
      legalName: registration.company.legalName,
    },
    areaOffice: {
      name: registration.areaOffice.name,
    },
    organization: null,
  }));
}

function getDerivedRegistrationTitle(role: Role) {
  if (role === "HORIC") {
    return "Review employer registration";
  }

  if (role === "REVENUE_ACCOUNTANT") {
    return "Assess registration contribution";
  }

  return "Review employer registration";
}

function buildAssigneeScope(
  requesterRole: Role,
  requester: {
    id: string;
    memberships: {
      organizationId: string | null;
      areaOfficeId: string | null;
      role: Role;
    }[];
  } | null,
) {
  if (!requester) {
    return [
      {
        assignedRole: requesterRole,
        assignedUserId: null,
        areaOfficeId: null,
        organizationId: null,
      },
    ];
  }

  const organizationIds = uniqueDefined(
    requester.memberships.map((membership) => membership.organizationId),
  );
  const areaOfficeIds = uniqueDefined(
    requester.memberships.map((membership) => membership.areaOfficeId),
  );

  return [
    {
      assignedUserId: requester.id,
    },
    ...(isHeadquartersRole(requesterRole)
      ? [
          {
            assignedRole: requesterRole,
          },
        ]
      : []),
    {
      assignedRole: requesterRole,
      areaOfficeId: {
        in: areaOfficeIds,
      },
    },
    {
      assignedRole: requesterRole,
      organizationId: {
        in: organizationIds,
      },
    },
    {
      assignedRole: requesterRole,
      assignedUserId: null,
      areaOfficeId: null,
      organizationId: null,
    },
  ];
}

function uniqueDefined(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isHeadquartersRole(role: Role) {
  return (
    role === "DIRECTOR_FSD" ||
    role === "HEAD_OF_DIVISION" ||
    role === "HQ_REIMBURSEMENT_OFFICER"
  );
}
