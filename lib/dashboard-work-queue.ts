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
        where: { isActive: true },
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

  const [companies, trainingPlanSubmissions] = await Promise.all([
    db.company.findMany({
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
    }),
    db.trainingPlanSubmission.findMany({
      where: {
        recordTier: "HOT",
        currentDesk: "COMPANY",
        status: "CHANGES_REQUESTED",
        company: {
          organizationId: {
            in: organizationIds,
          },
          recordTier: "HOT",
          isActive: true,
        },
      },
      select: {
        id: true,
        year: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            legalName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: input.take ?? 5,
    }),
  ]);

  const registrationActions = companies.map((company): EmployerDashboardAction => {
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

  const trainingPlanActions = trainingPlanSubmissions.map(
    (submission): EmployerDashboardAction => ({
      id: `training-plan-correction-${submission.id}`,
      title: "Training Plan correction requested",
      summary: `${submission.company.legalName} needs correction on the ${submission.year} Training Plan and L&D submission.`,
      priority: "HIGH",
      targetHref: `/registry/${submission.company.id}`,
      companyName: submission.company.legalName,
      createdAt: submission.updatedAt,
    }),
  );

  return [...registrationActions, ...trainingPlanActions]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, input.take ?? 5);
}
