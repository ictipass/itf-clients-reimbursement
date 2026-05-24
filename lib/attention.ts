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

  const [total, items] = await db.$transaction([
    db.workItem.count({
      where: scopedWhere,
    }),
    db.workItem.findMany({
      where: scopedWhere,
      select: {
        id: true,
        kind: true,
        priority: true,
        title: true,
        summary: true,
        targetHref: true,
        createdAt: true,
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
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: input.take ?? 5,
    }),
  ]);

  return {
    total,
    items,
  };
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
