import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type CreateComplianceYearInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  year: number;
  nigerianEmployeeCount?: number;
  expatriateEmployeeCount?: number;
  totalEmployeeCount?: number;
  turnover?: string;
  payrollTotal?: string;
  contributionAmount?: string;
  amountPaid?: string;
  amountPaidInWords?: string;
  paymentMode?: string;
  contributionPaidAt?: Date;
  annualPlanSubmittedAt?: Date;
  declarationName?: string;
  declarationPosition?: string;
  declarationPhone?: string;
  declaredAt?: Date;
};

export async function createComplianceYear(input: CreateComplianceYearInput) {
  if (!can(input.requesterRole, "compliance:submit")) {
    throw new Error("You do not have permission to create compliance returns.");
  }

  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

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

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some((membership) => membership.organizationId === company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this company's compliance records.");
  }

  return db.complianceYear.create({
    data: {
      companyId: company.id,
      year: input.year,
      nigerianEmployeeCount: input.nigerianEmployeeCount,
      expatriateEmployeeCount: input.expatriateEmployeeCount,
      totalEmployeeCount: input.totalEmployeeCount,
      turnover: input.turnover,
      payrollTotal: input.payrollTotal,
      contributionAmount: input.contributionAmount,
      amountPaid: input.amountPaid,
      amountPaidInWords: input.amountPaidInWords,
      paymentMode: input.paymentMode,
      contributionPaidAt: input.contributionPaidAt,
      annualPlanSubmittedAt: input.annualPlanSubmittedAt,
      declarationName: input.declarationName,
      declarationPosition: input.declarationPosition,
      declarationPhone: input.declarationPhone,
      declaredAt: input.declaredAt,
      status: "DRAFT",
    },
    select: {
      id: true,
    },
  });
}
