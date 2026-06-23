import { getDb } from "@/lib/db";
import type { WorkItemKind } from "@/lib/generated/prisma/client";
import { type Role } from "@/lib/rbac";

const awarenessWorkItemKinds: WorkItemKind[] = ["COMPLIANCE_AWARENESS", "TRAINING_FEEDBACK"];

export type AttentionSummaryInput = {
  requesterEmail?: string | null;
  requesterRole: Role;
  take?: number;
};

export type ModuleAttentionCounts = Record<string, number>;

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
            where: { isActive: true },
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

  const [workItemTotal, awarenessWorkItemTotal, actionWorkItems, awarenessWorkItems] =
    await db.$transaction([
    db.workItem.count({
      where: scopedWhere,
    }),
    db.workItem.count({
      where: {
        ...scopedWhere,
        kind: {
          in: awarenessWorkItemKinds,
        },
      },
    }),
    db.workItem.findMany({
      where: {
        ...scopedWhere,
        kind: {
          notIn: awarenessWorkItemKinds,
        },
      },
      select: {
        id: true,
        kind: true,
        priority: true,
        assignedRole: true,
        title: true,
        summary: true,
        targetHref: true,
        createdAt: true,
        assignedUserId: true,
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
    db.workItem.findMany({
      where: {
        ...scopedWhere,
        kind: {
          in: awarenessWorkItemKinds,
        },
      },
      select: {
        id: true,
        kind: true,
        priority: true,
        assignedRole: true,
        title: true,
        summary: true,
        targetHref: true,
        createdAt: true,
        assignedUserId: true,
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
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
  ]);
  const derivedItems = await getDerivedRegistrationDeskItems({
    requesterRole: input.requesterRole,
    requester,
    excludedRegistrationApplicationIds: actionWorkItems
      .map((item) => item.registrationApplicationId)
      .filter((value): value is string => Boolean(value)),
    take: input.take ?? 5,
  });
  const items = [...actionWorkItems, ...derivedItems]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, input.take ?? 5)
    .map(decorateQueueItem);
  const actionTotal = workItemTotal - awarenessWorkItemTotal + derivedItems.length;

  return {
    total: workItemTotal + derivedItems.length,
    actionTotal,
    awarenessTotal: awarenessWorkItemTotal,
    items,
    awarenessItems: awarenessWorkItems.map(decorateQueueItem),
  };
}

export async function getModuleAttentionCounts(input: AttentionSummaryInput) {
  const db = getDb();
  const requester = input.requesterEmail
    ? await db.user.findUnique({
        where: {
          email: input.requesterEmail,
        },
        select: {
          id: true,
          memberships: {
            where: { isActive: true },
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
  const workItems = await db.workItem.findMany({
    where: scopedWhere,
    select: {
      kind: true,
      targetHref: true,
    },
  });

  return workItems.reduce<ModuleAttentionCounts>((counts, item) => {
    const moduleKey = getModuleForWorkItem(item.kind, item.targetHref);

    counts[moduleKey] = (counts[moduleKey] ?? 0) + 1;

    return counts;
  }, {});
}

function getQueueCategory(kind: string) {
  return awarenessWorkItemKinds.some((awarenessKind) => awarenessKind === kind)
    ? "AWARENESS"
    : "ACTION";
}

function getQueueLabel(kind: string) {
  return getQueueCategory(kind) === "AWARENESS" ? "For awareness" : "Action required";
}

function decorateQueueItem<T extends {
  kind: string;
  assignedUserId: string | null;
  areaOffice: { name: string } | null;
}>(item: T) {
  return {
    ...item,
    queueCategory: getQueueCategory(item.kind),
    queueLabel: getQueueLabel(item.kind),
    ownershipLabel: getOwnershipLabel(item.assignedUserId, item.areaOffice?.name),
  };
}

function getModuleForWorkItem(kind: string, targetHref: string) {
  if (
    kind === "JURISDICTION_CHANGE_REVIEW" ||
    targetHref.startsWith("/jurisdiction-requests")
  ) {
    return "registry";
  }

  if (kind.startsWith("REGISTRATION") || targetHref.startsWith("/registry")) {
    return "registry";
  }

  if (kind.startsWith("COMPLIANCE") || targetHref.startsWith("/compliance")) {
    return "compliance";
  }

  if (kind.startsWith("TRAINING") || targetHref.startsWith("/training")) {
    return "training";
  }

  if (targetHref.startsWith("/claims")) {
    return "claims";
  }

  if (targetHref.startsWith("/management")) {
    return "management";
  }

  if (targetHref.startsWith("/settings")) {
    return "settings";
  }

  return "dashboard";
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
    assignedUserId: null,
    queueCategory: "ACTION",
    queueLabel: "Action required",
    ownershipLabel: registration.areaOffice.name
      ? `Shared ${registration.areaOffice.name} desk queue`
      : "Shared desk queue",
  }));
}

function getOwnershipLabel(assignedUserId: string | null, areaOfficeName: string | undefined) {
  if (assignedUserId) {
    return "Assigned to you";
  }

  if (areaOfficeName) {
    return `Shared ${areaOfficeName} desk queue`;
  }

  return "Shared role queue";
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
    role === "HQ_REIMBURSEMENT_OFFICER" ||
    role === "HQ_REVENUE_ACCOUNTANT"
  );
}
