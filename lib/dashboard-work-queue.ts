import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

export type EmployerDashboardAction = {
  id: string;
  title: string;
  summary: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  targetHref: string;
  companyName: string;
  createdAt: Date;
};

export async function listEmployerDashboardActions(input: {
  requesterEmail?: string | null;
  requesterRole: Role;
  take?: number;
}) {
  if (!input.requesterEmail || !can(input.requesterRole, "registry:submit")) {
    return [];
  }

  const db = getDb();
  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  const organizationIds = Array.from(
    new Set(
      requester?.memberships
        .map((membership) => membership.organizationId)
        .filter((value): value is string => Boolean(value)) ?? [],
    ),
  );

  if (organizationIds.length === 0) {
    return [];
  }

  const companies = await db.company.findMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
      recordTier: "HOT",
      isActive: true,
      itfEmployerNumber: null,
      OR: [
        {
          areaOfficeId: {
            not: null,
          },
          registrationApplication: null,
        },
        {
          registrationApplication: {
            is: {
              currentDesk: "COMPANY",
              status: "CHANGES_REQUESTED",
            },
          },
        },
        {
          registrationApplication: {
            is: {
              currentDesk: "COMPANY",
              status: "SUBMITTED",
              contributionAssessment: {
                is: {
                  amReleasedAt: {
                    not: null,
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      legalName: true,
      createdAt: true,
      registrationApplication: {
        select: {
          id: true,
          status: true,
          currentDesk: true,
          updatedAt: true,
          contributionAssessment: {
            select: {
              amReleasedAt: true,
              recommendedAmount: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: input.take ?? 5,
  });

  return companies.map((company): EmployerDashboardAction => {
    if (!company.registrationApplication) {
      return {
        id: `registration-submit-${company.id}`,
        title: "Submit employer registration",
        summary: `${company.legalName} has an Area Office selected and can be submitted for registration review.`,
        priority: "NORMAL",
        targetHref: `/registry/${company.id}`,
        companyName: company.legalName,
        createdAt: company.createdAt,
      };
    }

    if (company.registrationApplication.status === "CHANGES_REQUESTED") {
      return {
        id: `registration-correction-${company.registrationApplication.id}`,
        title: "Registration correction requested",
        summary: `${company.legalName} needs correction before it can continue registration review.`,
        priority: "HIGH",
        targetHref: `/registry/${company.id}`,
        companyName: company.legalName,
        createdAt: company.registrationApplication.updatedAt,
      };
    }

    return {
      id: `registration-receipt-${company.registrationApplication.id}`,
      title: "Upload contribution payment receipt",
      summary: `${company.legalName} has a released contribution recommendation awaiting payment evidence.`,
      priority: "HIGH",
      targetHref: `/registry/${company.id}`,
      companyName: company.legalName,
      createdAt: company.registrationApplication.updatedAt,
    };
  });
}
