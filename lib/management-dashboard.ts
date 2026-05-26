import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type ManagementDashboardFilters = {
  year?: number;
  areaOfficeId?: string;
};

export type ManagementDashboardInput = {
  requesterRole: Role;
  filters?: ManagementDashboardFilters;
};

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

function companyAreaOfficeWhere(areaOfficeId?: string) {
  return areaOfficeId
    ? {
        company: {
          areaOfficeId,
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

export async function getManagementDashboard(input: ManagementDashboardInput) {
  requireManagementAccess(input.requesterRole);

  const db = getDb();
  const filters = input.filters ?? {};
  const yearRange = getYearRange(filters.year);
  const areaOfficeFilter = filters.areaOfficeId ? { areaOfficeId: filters.areaOfficeId } : {};
  const companyAreaFilter = companyAreaOfficeWhere(filters.areaOfficeId);
  const complianceCompanyAreaFilter = filters.areaOfficeId
    ? {
        company: {
          areaOfficeId: filters.areaOfficeId,
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
        ...(filters.areaOfficeId ? { areaOfficeId: filters.areaOfficeId } : {}),
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
        ...(filters.areaOfficeId ? { areaOfficeId: filters.areaOfficeId } : {}),
      },
    }),
    db.registrationContributionAssessment.aggregate({
      where: {
        recordTier: "HOT",
        amReleasedAt: yearRange,
        ...(filters.areaOfficeId ? { areaOfficeId: filters.areaOfficeId } : {}),
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
        ...(filters.areaOfficeId ? { id: filters.areaOfficeId } : {}),
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
  ]);

  const registrationRevenueValue = decimalToNumber(registrationRevenue._sum.recommendedAmount);
  const complianceRevenueValue = decimalToNumber(complianceRevenue._sum.amountPaid);
  const claimsPaidValue = decimalToNumber(claimsPaid._sum.claimRecommendedAmount);
  const claimsRecommendedValue = decimalToNumber(claimsRecommended._sum.claimRecommendedAmount);
  const claimsRequestedValue = decimalToNumber(claimsRecommended._sum.claimedAmount);

  return {
    filters,
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
  };
}
