import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type ManagementDashboardFilters = {
  year?: number;
  areaOfficeId?: string;
};

export type ManagementDashboardInput = {
  requesterEmail: string;
  requesterRole: Role;
  filters?: ManagementDashboardFilters;
};

const hqManagementRoles: Role[] = [
  "SYSTEM_ADMIN",
  "WORKSPACE_APP_ADMIN",
  "ITF_AUDITOR",
  "DIRECTOR_FSD",
  "HEAD_OF_DIVISION",
  "HQ_REIMBURSEMENT_OFFICER",
  "HQ_REVENUE_ACCOUNTANT",
];

function requireManagementAccess(role: Role) {
  if (!isItfRole(role) || (!can(role, "workspace:manage") && !can(role, "audit:read"))) {
    throw new Error("You do not have permission to view management statistics.");
  }
}

function decimalToNumber(value: { toString(): string } | null | undefined) {
  if (!value) {
    return 0;
  }

  return Number(value.toString());
}

function getYearRange(year?: number) {
  if (!year) {
    return undefined;
  }

  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function areaOfficeIdWhere(areaOfficeIds?: string[]) {
  if (!areaOfficeIds) {
    return undefined;
  }

  return {
    in: areaOfficeIds,
  };
}

function companyAreaOfficeWhere(areaOfficeIds?: string[]) {
  return areaOfficeIds
    ? {
        company: {
          areaOfficeId: areaOfficeIdWhere(areaOfficeIds),
        },
      }
    : {};
}

export async function listManagementDashboardAreaOffices() {
  const db = getDb();

  return db.areaOffice.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getManagementDashboardScope(input: {
  requesterEmail: string;
  requesterRole: Role;
  requestedAreaOfficeId?: string;
}) {
  requireManagementAccess(input.requesterRole);

  const db = getDb();
  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        select: {
          areaOfficeId: true,
          areaOffice: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const isHqScope = can(input.requesterRole, "workspace:manage") || hqManagementRoles.includes(input.requesterRole);

  if (isHqScope) {
    return {
      scopeType: "HQ" as const,
      selectedAreaOfficeId: input.requestedAreaOfficeId,
      allowedAreaOffices: undefined,
      effectiveAreaOfficeIds: input.requestedAreaOfficeId ? [input.requestedAreaOfficeId] : undefined,
    };
  }

  const allowedAreaOffices = requester.memberships
    .map((membership) => membership.areaOffice)
    .filter((areaOffice): areaOffice is { id: string; name: string } => Boolean(areaOffice));

  if (allowedAreaOffices.length === 0) {
    throw new Error("No Area Office management scope was found for this user.");
  }

  const requestedAreaOfficeIsAllowed = allowedAreaOffices.some(
    (areaOffice) => areaOffice.id === input.requestedAreaOfficeId,
  );
  const selectedAreaOfficeId = requestedAreaOfficeIsAllowed
    ? input.requestedAreaOfficeId
    : allowedAreaOffices[0]?.id;

  return {
    scopeType: "AREA_OFFICE" as const,
    selectedAreaOfficeId,
    allowedAreaOffices,
    effectiveAreaOfficeIds: selectedAreaOfficeId ? [selectedAreaOfficeId] : allowedAreaOffices.map((areaOffice) => areaOffice.id),
  };
}

export async function getManagementDashboard(input: ManagementDashboardInput) {
  requireManagementAccess(input.requesterRole);

  const db = getDb();
  const filters = input.filters ?? {};
  const scope = await getManagementDashboardScope({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    requestedAreaOfficeId: filters.areaOfficeId,
  });
  const yearRange = getYearRange(filters.year);
  const effectiveAreaOfficeIds = scope.effectiveAreaOfficeIds;
  const areaOfficeFilter = effectiveAreaOfficeIds
    ? { areaOfficeId: areaOfficeIdWhere(effectiveAreaOfficeIds) }
    : {};
  const companyAreaFilter = companyAreaOfficeWhere(effectiveAreaOfficeIds);
  const complianceCompanyAreaFilter = effectiveAreaOfficeIds
    ? {
        company: {
          areaOfficeId: areaOfficeIdWhere(effectiveAreaOfficeIds),
        },
      }
    : {};

  const [
    totalCompanies,
    activeCompanies,
    registeredCompanies,
    approvedRegistrationApplications,
    pendingRegistrationApplications,
    openWorkItems,
    urgentWorkItems,
    registrationRevenue,
    complianceRevenue,
    claimsPaid,
    claimsPending,
    claimsRecommended,
    complianceApproved,
    areaOfficeBreakdown,
    scopedAreaOffices,
  ] = await Promise.all([
    db.company.count({
      where: {
        recordTier: "HOT",
        ...areaOfficeFilter,
      },
    }),
    db.company.count({
      where: {
        recordTier: "HOT",
        status: "ACTIVE",
        ...areaOfficeFilter,
      },
    }),
    db.company.count({
      where: {
        recordTier: "HOT",
        itfEmployerNumber: {
          not: null,
        },
        ...areaOfficeFilter,
      },
    }),
    db.registrationApplication.count({
      where: {
        recordTier: "HOT",
        status: "APPROVED",
        completedAt: yearRange,
        ...areaOfficeFilter,
      },
    }),
    db.registrationApplication.count({
      where: {
        recordTier: "HOT",
        status: {
          in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
        },
        ...areaOfficeFilter,
      },
    }),
    db.workItem.count({
      where: {
        recordTier: "HOT",
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        ...(effectiveAreaOfficeIds ? { areaOfficeId: areaOfficeIdWhere(effectiveAreaOfficeIds) } : {}),
      },
    }),
    db.workItem.count({
      where: {
        recordTier: "HOT",
        priority: {
          in: ["HIGH", "URGENT"],
        },
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        ...(effectiveAreaOfficeIds ? { areaOfficeId: areaOfficeIdWhere(effectiveAreaOfficeIds) } : {}),
      },
    }),
    db.registrationContributionAssessment.aggregate({
      where: {
        recordTier: "HOT",
        amReleasedAt: yearRange,
        ...(effectiveAreaOfficeIds ? { areaOfficeId: areaOfficeIdWhere(effectiveAreaOfficeIds) } : {}),
      },
      _sum: {
        recommendedAmount: true,
      },
    }),
    db.complianceYear.aggregate({
      where: {
        recordTier: "HOT",
        year: filters.year,
        ...complianceCompanyAreaFilter,
      },
      _sum: {
        amountPaid: true,
      },
    }),
    db.reimbursementClaim.aggregate({
      where: {
        recordTier: "HOT",
        status: "SETTLED",
        settledAt: yearRange,
        ...companyAreaFilter,
      },
      _sum: {
        claimRecommendedAmount: true,
      },
    }),
    db.reimbursementClaim.count({
      where: {
        recordTier: "HOT",
        status: {
          in: ["SUBMITTED", "IN_REVIEW", "APPROVED"],
        },
        claimYear: filters.year,
        ...companyAreaFilter,
      },
    }),
    db.reimbursementClaim.aggregate({
      where: {
        recordTier: "HOT",
        claimYear: filters.year,
        ...companyAreaFilter,
      },
      _sum: {
        claimRecommendedAmount: true,
        claimedAmount: true,
      },
    }),
    db.complianceYear.count({
      where: {
        recordTier: "HOT",
        status: "APPROVED",
        year: filters.year,
        ...complianceCompanyAreaFilter,
      },
    }),
    db.areaOffice.findMany({
      where: {
        isActive: true,
        ...(effectiveAreaOfficeIds ? { id: areaOfficeIdWhere(effectiveAreaOfficeIds) } : {}),
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            companies: {
              where: {
                recordTier: "HOT",
              },
            },
            registrationApplications: {
              where: {
                recordTier: "HOT",
                status: {
                  in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
                },
              },
            },
            workItems: {
              where: {
                recordTier: "HOT",
                status: {
                  in: ["OPEN", "ACKNOWLEDGED"],
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 20,
    }),
    db.areaOffice.findMany({
      where: {
        isActive: true,
        ...(effectiveAreaOfficeIds ? { id: areaOfficeIdWhere(effectiveAreaOfficeIds) } : {}),
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const registrationRevenueValue = decimalToNumber(registrationRevenue._sum.recommendedAmount);
  const complianceRevenueValue = decimalToNumber(complianceRevenue._sum.amountPaid);
  const claimsPaidValue = decimalToNumber(claimsPaid._sum.claimRecommendedAmount);
  const claimsRecommendedValue = decimalToNumber(claimsRecommended._sum.claimRecommendedAmount);
  const claimsRequestedValue = decimalToNumber(claimsRecommended._sum.claimedAmount);

  const financialBreakdown = await Promise.all(
    scopedAreaOffices.map(async (areaOffice) => {
      const [
        officeRegistrationRevenue,
        officeComplianceRevenue,
        officeClaimsPaid,
        officeComplianceApproved,
      ] = await Promise.all([
        db.registrationContributionAssessment.aggregate({
          where: {
            recordTier: "HOT",
            areaOfficeId: areaOffice.id,
            amReleasedAt: yearRange,
          },
          _sum: {
            recommendedAmount: true,
          },
        }),
        db.complianceYear.aggregate({
          where: {
            recordTier: "HOT",
            year: filters.year,
            company: {
              areaOfficeId: areaOffice.id,
            },
          },
          _sum: {
            amountPaid: true,
          },
        }),
        db.reimbursementClaim.aggregate({
          where: {
            recordTier: "HOT",
            status: "SETTLED",
            settledAt: yearRange,
            company: {
              areaOfficeId: areaOffice.id,
            },
          },
          _sum: {
            claimRecommendedAmount: true,
          },
        }),
        db.complianceYear.count({
          where: {
            recordTier: "HOT",
            status: "APPROVED",
            year: filters.year,
            company: {
              areaOfficeId: areaOffice.id,
            },
          },
        }),
      ]);

      return {
        id: areaOffice.id,
        name: areaOffice.name,
        registrationRevenue: decimalToNumber(officeRegistrationRevenue._sum.recommendedAmount),
        complianceRevenue: decimalToNumber(officeComplianceRevenue._sum.amountPaid),
        claimsPaid: decimalToNumber(officeClaimsPaid._sum.claimRecommendedAmount),
        complianceApproved: officeComplianceApproved,
      };
    }),
  );

  return {
    filters: {
      ...filters,
      areaOfficeId: scope.selectedAreaOfficeId,
    },
    scope,
    headline: {
      totalCompanies,
      activeCompanies,
      registeredCompanies,
      complianceApproved,
      registrationRevenue: registrationRevenueValue,
      complianceRevenue: complianceRevenueValue,
      totalRevenue: registrationRevenueValue + complianceRevenueValue,
      claimsPaid: claimsPaidValue,
      claimsPending,
      claimsRecommended: claimsRecommendedValue,
      claimsRequested: claimsRequestedValue,
      approvedRegistrationApplications,
      pendingRegistrationApplications,
      openWorkItems,
      urgentWorkItems,
    },
    areaOfficeBreakdown: areaOfficeBreakdown.map((areaOffice) => ({
      id: areaOffice.id,
      name: areaOffice.name,
      companies: areaOffice._count.companies,
      pendingRegistrations: areaOffice._count.registrationApplications,
      openWorkItems: areaOffice._count.workItems,
    })),
    financialBreakdown,
  };
}
