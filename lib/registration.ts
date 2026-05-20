import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type SubmitRegistrationApplicationInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
};

const registrationDeskTransitions = [
  "am_to_horic",
  "horic_to_ra",
  "ra_to_horic",
  "horic_to_am",
  "am_to_company",
] as const;

export type RegistrationDeskTransition = (typeof registrationDeskTransitions)[number];

export type RouteRegistrationApplicationInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  transition: RegistrationDeskTransition;
  reason?: string;
};

export type AssessRegistrationContributionInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  payrollBasis?: string;
  turnoverBasis?: string;
  recommendedAmount: string;
  assessmentNote?: string;
};

export function getRegistrationDeskTransitions() {
  return registrationDeskTransitions;
}

export async function submitRegistrationApplication(input: SubmitRegistrationApplicationInput) {
  if (!can(input.requesterRole, "registry:submit")) {
    throw new Error("You do not have permission to submit company registration.");
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
      areaOfficeId: true,
      status: true,
      registrationApplication: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  if (!company.areaOfficeId) {
    throw new Error("Select an Area Office before submitting registration.");
  }

  const areaOfficeId = company.areaOfficeId;

  if (
    company.registrationApplication &&
    company.registrationApplication.status !== "DRAFT" &&
    company.registrationApplication.status !== "CHANGES_REQUESTED"
  ) {
    throw new Error("This company registration has already been submitted.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
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
    throw new Error("You do not have access to this company's registration.");
  }

  return db.$transaction(async (tx) => {
    const registrationApplication = company.registrationApplication
      ? await tx.registrationApplication.update({
          where: {
            id: company.registrationApplication.id,
          },
          data: {
            areaOfficeId,
            submittedById: requester.id,
            status: "SUBMITTED",
            currentDesk: "AREA_MANAGER",
            submittedAt: new Date(),
          },
          select: {
            id: true,
          },
        })
      : await tx.registrationApplication.create({
          data: {
            companyId: company.id,
            areaOfficeId,
            submittedById: requester.id,
            status: "SUBMITTED",
            currentDesk: "AREA_MANAGER",
            submittedAt: new Date(),
          },
          select: {
            id: true,
          },
        });

    await tx.company.update({
      where: {
        id: company.id,
      },
      data: {
        status: "PENDING_REVIEW",
      },
      select: {
        id: true,
      },
    });

    return registrationApplication;
  });
}

function resolveDeskTransition(transition: RegistrationDeskTransition) {
  if (transition === "am_to_horic") {
    return {
      from: "AREA_MANAGER" as const,
      to: "HORIC" as const,
      allowedRoles: ["AREA_MANAGER"] as const,
      label: "Forwarded from AM to HORIC",
    };
  }

  if (transition === "horic_to_ra") {
    return {
      from: "HORIC" as const,
      to: "REVENUE_ACCOUNTANT" as const,
      allowedRoles: ["HORIC"] as const,
      label: "Forwarded from HORIC to RA",
    };
  }

  if (transition === "ra_to_horic") {
    return {
      from: "REVENUE_ACCOUNTANT" as const,
      to: "HORIC" as const,
      allowedRoles: ["REVENUE_ACCOUNTANT"] as const,
      label: "Forwarded from RA to HORIC",
    };
  }

  if (transition === "horic_to_am") {
    return {
      from: "HORIC" as const,
      to: "AREA_MANAGER" as const,
      allowedRoles: ["HORIC"] as const,
      label: "Forwarded from HORIC to AM",
    };
  }

  return {
    from: "AREA_MANAGER" as const,
    to: "COMPANY" as const,
    allowedRoles: ["AREA_MANAGER"] as const,
    label: "Forwarded from AM to company",
  };
}

function hasDeskRoutingRole(role: Role, allowedRoles: readonly Role[]) {
  return (
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    allowedRoles.includes(role)
  );
}

export async function routeRegistrationApplication(input: RouteRegistrationApplicationInput) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to route registration applications.");
  }

  const transition = resolveDeskTransition(input.transition);

  if (!hasDeskRoutingRole(input.requesterRole, transition.allowedRoles)) {
    throw new Error("Your role cannot perform this registration desk action.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      areaOfficeId: true,
      currentDesk: true,
    },
  });

  if (!registrationApplication) {
    throw new Error("Submitted registration application was not found.");
  }

  if (registrationApplication.currentDesk !== transition.from) {
    throw new Error(`Registration is currently with ${registrationApplication.currentDesk}.`);
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess =
    input.requesterRole === "SYSTEM_ADMIN" ||
    input.requesterRole === "WORKSPACE_APP_ADMIN" ||
    actor.memberships.some(
      (membership) => membership.areaOfficeId === registrationApplication.areaOfficeId,
    );

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office registration.");
  }

  const reason = [transition.label, input.reason].filter(Boolean).join(": ");

  return db.$transaction(async (tx) => {
    const updated = await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        currentDesk: transition.to,
        status: transition.to === "COMPANY" ? "CHANGES_REQUESTED" : "SUBMITTED",
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        action: transition.to === "COMPANY" ? "REQUEST_CHANGES" : "FORWARD",
        reason,
      },
    });

    return updated;
  });
}

export async function assessRegistrationContribution(input: AssessRegistrationContributionInput) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to assess registration contribution.");
  }

  if (
    input.requesterRole !== "REVENUE_ACCOUNTANT" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only a Revenue Accountant can recommend registration contribution.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "REVENUE_ACCOUNTANT",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      areaOfficeId: true,
    },
  });

  if (!registrationApplication) {
    throw new Error("Registration application is not currently with Revenue Accountant.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess =
    input.requesterRole === "SYSTEM_ADMIN" ||
    input.requesterRole === "WORKSPACE_APP_ADMIN" ||
    actor.memberships.some(
      (membership) => membership.areaOfficeId === registrationApplication.areaOfficeId,
    );

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office registration.");
  }

  return db.$transaction(async (tx) => {
    const assessment = await tx.registrationContributionAssessment.upsert({
      where: {
        registrationApplicationId: registrationApplication.id,
      },
      update: {
        assessedById: actor.id,
        payrollBasis: input.payrollBasis,
        turnoverBasis: input.turnoverBasis,
        recommendedAmount: input.recommendedAmount,
        assessmentNote: input.assessmentNote,
        assessedAt: new Date(),
      },
      create: {
        registrationApplicationId: registrationApplication.id,
        companyId: registrationApplication.companyId,
        areaOfficeId: registrationApplication.areaOfficeId,
        assessedById: actor.id,
        payrollBasis: input.payrollBasis,
        turnoverBasis: input.turnoverBasis,
        recommendedAmount: input.recommendedAmount,
        assessmentNote: input.assessmentNote,
      },
      select: {
        id: true,
      },
    });

    await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        currentDesk: "HORIC",
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        action: "RECOMMEND",
        reason: [`Recommended contribution: ${input.recommendedAmount}`, input.assessmentNote]
          .filter(Boolean)
          .join(": "),
      },
    });

    return assessment;
  });
}
