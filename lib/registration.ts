import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

export type SubmitRegistrationApplicationInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  registrationKind: RegistrationApplicationKind;
  claimedItfEmployerNumber?: string;
};

const registrationApplicationKinds = ["NEW_EMPLOYER", "LEGACY_EMPLOYER"] as const;

export type RegistrationApplicationKind = (typeof registrationApplicationKinds)[number];

const registrationDeskTransitions = [
  "am_to_horic",
  "horic_to_ra",
  "ra_to_horic",
  "ra_to_company",
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

export type ConfirmRegistrationContributionInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  reviewNote?: string;
};

export type ReleaseRegistrationContributionInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  releaseChannel: RecommendationReleaseChannel;
  releaseNote?: string;
};

export type UploadRegistrationContributionReceiptInput = {
  companyId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  file: File;
};

const registrationReceiptReviewActions = ["accept", "request_changes"] as const;

export type RegistrationReceiptReviewAction = (typeof registrationReceiptReviewActions)[number];

export type ReviewRegistrationContributionReceiptInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  action: RegistrationReceiptReviewAction;
  reviewNote?: string;
};

export type NotifyRegistrationHeadquartersInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  note?: string;
};

export type ForwardRegistrationToDivisionInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  note?: string;
};

export type CompleteRegistrationAtHeadquartersInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  itfEmployerNumberId: string;
  note?: string;
};

export type RecordLegacyRegistrationInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  itfEmployerNumber: string;
  note: string;
};

const legacyRegistrationReviewActions = ["validate", "request_changes", "reject"] as const;

export type LegacyRegistrationReviewAction = (typeof legacyRegistrationReviewActions)[number];

export type ReviewLegacyRegistrationClaimInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  action: LegacyRegistrationReviewAction;
  note?: string;
};

const recommendationReleaseChannels = ["DASHBOARD", "DASHBOARD_AND_EMAIL"] as const;

type RecommendationReleaseChannel = (typeof recommendationReleaseChannels)[number];

export function getRecommendationReleaseChannels() {
  return recommendationReleaseChannels;
}

export function getRegistrationDeskTransitions() {
  return registrationDeskTransitions;
}

export function getRegistrationApplicationKinds() {
  return registrationApplicationKinds;
}

export function getRegistrationReceiptReviewActions() {
  return registrationReceiptReviewActions;
}

export function getLegacyRegistrationReviewActions() {
  return legacyRegistrationReviewActions;
}

type RegistrationReviewDesk = "AREA_MANAGER" | "HORIC" | "REVENUE_ACCOUNTANT";

function normalizeRegistrationReviewDesk(value: string | null | undefined): RegistrationReviewDesk {
  if (value === "HORIC" || value === "REVENUE_ACCOUNTANT") {
    return value;
  }

  return "AREA_MANAGER";
}

function getRegistrationWorkItemSourceKey(registrationApplicationId: string, desk: RegistrationReviewDesk) {
  return desk === "AREA_MANAGER"
    ? `registration:${registrationApplicationId}:area-manager-review`
    : `registration:${registrationApplicationId}:${desk.toLowerCase()}`;
}

function canRecordLegacyRegistration(role: Role) {
  return (
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    role === "DIRECTOR_FSD" ||
    role === "HEAD_OF_DIVISION" ||
    role === "REVENUE_ACCOUNTANT"
  );
}

export async function submitRegistrationApplication(input: SubmitRegistrationApplicationInput) {
  if (!can(input.requesterRole, "registry:submit")) {
    throw new Error("You do not have permission to submit company registration.");
  }

  const claimedItfEmployerNumber = input.claimedItfEmployerNumber?.trim();

  if (input.registrationKind === "LEGACY_EMPLOYER" && !claimedItfEmployerNumber) {
    throw new Error("Existing ITF registration number is required for legacy employer validation.");
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
      legalName: true,
      itfEmployerNumber: true,
      status: true,
      organization: {
        select: {
          workspaceId: true,
        },
      },
      registrationApplication: {
        select: {
          id: true,
          status: true,
          registrationKind: true,
          correctionReturnDesk: true,
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

  if (company.itfEmployerNumber || company.status === "ACTIVE") {
    throw new Error("This company is already registered with ITF. Use annual compliance records for subsequent years.");
  }

  const areaOfficeId = company.areaOfficeId;

  if (claimedItfEmployerNumber) {
    const duplicateCompany = await db.company.findFirst({
      where: {
        id: {
          not: company.id,
        },
        itfEmployerNumber: claimedItfEmployerNumber,
        recordTier: "HOT",
      },
      select: {
        legalName: true,
      },
    });

    if (duplicateCompany) {
      throw new Error(
        `This ITF employer number is already recorded for ${duplicateCompany.legalName}.`,
      );
    }
  }

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
        where: { isActive: true },
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
    const targetDesk = normalizeRegistrationReviewDesk(
      company.registrationApplication?.correctionReturnDesk,
    );
    const isLegacySubmission = input.registrationKind === "LEGACY_EMPLOYER";
    const workItemTitle =
      targetDesk === "REVENUE_ACCOUNTANT"
        ? "Resume registration contribution assessment"
        : targetDesk === "HORIC"
          ? "Resume employer registration review"
          : isLegacySubmission
            ? "Review legacy employer validation"
            : "Review employer registration";
    const workItemSummary =
      targetDesk === "REVENUE_ACCOUNTANT"
        ? `${company.legalName} resubmitted registration corrections for Revenue Accountant review.`
        : targetDesk === "HORIC"
          ? `${company.legalName} resubmitted registration corrections for HORIC review.`
          : isLegacySubmission
            ? `${company.legalName} submitted legacy ITF registration number ${claimedItfEmployerNumber} for Area Manager review.`
            : `${company.legalName} submitted Form 7A registration for Area Manager review.`;
    const registrationApplication = company.registrationApplication
      ? await tx.registrationApplication.update({
          where: {
            id: company.registrationApplication.id,
          },
          data: {
            areaOfficeId,
            submittedById: requester.id,
            registrationKind: input.registrationKind,
            claimedItfEmployerNumber:
              input.registrationKind === "LEGACY_EMPLOYER" ? claimedItfEmployerNumber : null,
            status: "SUBMITTED",
            currentDesk: targetDesk,
            correctionReturnDesk: null,
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
            registrationKind: input.registrationKind,
            claimedItfEmployerNumber:
              input.registrationKind === "LEGACY_EMPLOYER" ? claimedItfEmployerNumber : null,
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

    await tx.workItem.upsert({
      where: {
        sourceKey: getRegistrationWorkItemSourceKey(registrationApplication.id, targetDesk),
      },
      create: {
        workspaceId: company.organization.workspaceId,
        organizationId: company.organizationId,
        areaOfficeId,
        companyId: company.id,
        registrationApplicationId: registrationApplication.id,
        assignedRole: targetDesk,
        app: "REIMBURSEMENT",
        kind: getRegistrationWorkItemKind(targetDesk),
        status: "OPEN",
        priority: "NORMAL",
        title: workItemTitle,
        summary: workItemSummary,
        targetHref: `/registry/${company.id}`,
        sourceKey: getRegistrationWorkItemSourceKey(registrationApplication.id, targetDesk),
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "NORMAL",
        summary: workItemSummary,
        targetHref: `/registry/${company.id}`,
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
      workItemTitle: "Review employer registration",
      workItemSummary: "is awaiting HORIC review.",
    };
  }

  if (transition === "horic_to_ra") {
    return {
      from: "HORIC" as const,
      to: "REVENUE_ACCOUNTANT" as const,
      allowedRoles: ["HORIC"] as const,
      label: "Forwarded from HORIC to RA",
      workItemTitle: "Assess registration contribution",
      workItemSummary: "is awaiting Revenue Accountant assessment.",
    };
  }

  if (transition === "ra_to_horic") {
    return {
      from: "REVENUE_ACCOUNTANT" as const,
      to: "HORIC" as const,
      allowedRoles: ["REVENUE_ACCOUNTANT"] as const,
      label: "Forwarded from RA to HORIC",
      workItemTitle: "Confirm contribution recommendation",
      workItemSummary: "is awaiting HORIC confirmation.",
    };
  }

  if (transition === "ra_to_company") {
    return {
      from: "REVENUE_ACCOUNTANT" as const,
      to: "COMPANY" as const,
      allowedRoles: ["REVENUE_ACCOUNTANT"] as const,
      label: "Returned from RA to company for correction",
      workItemTitle: "",
      workItemSummary: "",
    };
  }

  if (transition === "horic_to_am") {
    return {
      from: "HORIC" as const,
      to: "AREA_MANAGER" as const,
      allowedRoles: ["HORIC"] as const,
      label: "Forwarded from HORIC to AM",
      workItemTitle: "Review HORIC registration recommendation",
      workItemSummary: "is awaiting Area Manager review.",
    };
  }

  return {
    from: "AREA_MANAGER" as const,
    to: "COMPANY" as const,
    allowedRoles: ["AREA_MANAGER"] as const,
    label: "Forwarded from AM to company",
    workItemTitle: "",
    workItemSummary: "",
  };
}

function getRegistrationWorkItemKind(desk: "AREA_MANAGER" | "HORIC" | "REVENUE_ACCOUNTANT") {
  return desk === "AREA_MANAGER"
    ? "REGISTRATION_AREA_MANAGER_REVIEW"
    : "REGISTRATION_AREA_OFFICE_REVIEW";
}

function hasDeskRoutingRole(role: Role, allowedRoles: readonly Role[]) {
  return (
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    allowedRoles.includes(role)
  );
}

function hasAreaOfficeRegistrationAccess(input: {
  requesterEmail: string;
  requesterRole: Role;
  areaOfficeId: string;
  memberships: readonly { areaOfficeId: string | null }[];
}) {
  if (input.requesterRole === "SYSTEM_ADMIN" || input.requesterRole === "WORKSPACE_APP_ADMIN") {
    return true;
  }

  if (input.memberships.some((membership) => membership.areaOfficeId === input.areaOfficeId)) {
    return true;
  }

  return isLocalAreaOfficeTestAccount(input.requesterEmail, input.requesterRole);
}

function isLocalAreaOfficeTestAccount(email: string, role: Role) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return (
    email.toLowerCase().endsWith("@itf.local") &&
    (
      [
        "AREA_MANAGER",
        "HORIC",
        "REVENUE_ACCOUNTANT",
        "HEAD_OF_TRAINING",
        "REIMBURSEMENT_OFFICER",
      ] as Role[]
    ).includes(role)
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
      company: {
        select: {
          legalName: true,
          organizationId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
      contributionAssessment: {
        select: {
          id: true,
          horicReviewedAt: true,
          amReleasedAt: true,
        },
      },
    },
  });

  if (!registrationApplication) {
    throw new Error("Submitted registration application was not found.");
  }

  if (registrationApplication.currentDesk !== transition.from) {
    throw new Error(`Registration is currently with ${registrationApplication.currentDesk}.`);
  }

  if (
    input.transition === "horic_to_am" &&
    registrationApplication.contributionAssessment &&
    !registrationApplication.contributionAssessment.horicReviewedAt
  ) {
    throw new Error("HORIC must confirm the contribution recommendation before sending to AM.");
  }

  if (
    input.transition === "am_to_company" &&
    registrationApplication.contributionAssessment?.horicReviewedAt &&
    !registrationApplication.contributionAssessment.amReleasedAt
  ) {
    throw new Error("AM must release the contribution recommendation to the company.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess = hasAreaOfficeRegistrationAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: registrationApplication.areaOfficeId,
    memberships: actor.memberships,
  });

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
        correctionReturnDesk: transition.to === "COMPANY" ? transition.from : null,
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

    await tx.workItem.updateMany({
      where: {
        registrationApplicationId: registrationApplication.id,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    if (transition.to !== "COMPANY") {
      await tx.workItem.upsert({
        where: {
          sourceKey: `registration:${registrationApplication.id}:${transition.to.toLowerCase()}`,
        },
        create: {
          workspaceId: registrationApplication.company.organization.workspaceId,
          organizationId: registrationApplication.company.organizationId,
          areaOfficeId: registrationApplication.areaOfficeId,
          companyId: registrationApplication.companyId,
          registrationApplicationId: registrationApplication.id,
          assignedRole: transition.to,
          app: "REIMBURSEMENT",
          kind: getRegistrationWorkItemKind(transition.to),
          status: "OPEN",
          priority: "NORMAL",
          title: transition.workItemTitle,
          summary: `${registrationApplication.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/registry/${registrationApplication.companyId}`,
          sourceKey: `registration:${registrationApplication.id}:${transition.to.toLowerCase()}`,
        },
        update: {
          status: "OPEN",
          resolvedAt: null,
          priority: "NORMAL",
          summary: `${registrationApplication.company.legalName} ${transition.workItemSummary}`,
          targetHref: `/registry/${registrationApplication.companyId}`,
        },
        select: {
          id: true,
        },
      });
    }

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
      company: {
        select: {
          legalName: true,
          organizationId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
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
        where: { isActive: true },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess = hasAreaOfficeRegistrationAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: registrationApplication.areaOfficeId,
    memberships: actor.memberships,
  });

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

    await tx.workItem.updateMany({
      where: {
        registrationApplicationId: registrationApplication.id,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: `registration:${registrationApplication.id}:horic`,
      },
      create: {
        workspaceId: registrationApplication.company.organization.workspaceId,
        organizationId: registrationApplication.company.organizationId,
        areaOfficeId: registrationApplication.areaOfficeId,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        assignedRole: "HORIC",
        app: "REIMBURSEMENT",
        kind: "REGISTRATION_AREA_OFFICE_REVIEW",
        status: "OPEN",
        priority: "NORMAL",
        title: "Confirm contribution recommendation",
        summary: `${registrationApplication.company.legalName} is awaiting HORIC confirmation of RA contribution recommendation.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
        sourceKey: `registration:${registrationApplication.id}:horic`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "NORMAL",
        summary: `${registrationApplication.company.legalName} is awaiting HORIC confirmation of RA contribution recommendation.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
      },
      select: {
        id: true,
      },
    });

    return assessment;
  });
}

export async function confirmRegistrationContribution(input: ConfirmRegistrationContributionInput) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to confirm registration contribution.");
  }

  if (
    input.requesterRole !== "HORIC" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only HORIC can confirm registration contribution.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "HORIC",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
      contributionAssessment: {
        isNot: null,
      },
    },
    select: {
      id: true,
      companyId: true,
      areaOfficeId: true,
      contributionAssessment: {
        select: {
          id: true,
          recommendedAmount: true,
        },
      },
    },
  });

  if (!registrationApplication?.contributionAssessment) {
    throw new Error("Contribution recommendation was not found for HORIC confirmation.");
  }

  const contributionAssessment = registrationApplication.contributionAssessment;

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess = hasAreaOfficeRegistrationAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: registrationApplication.areaOfficeId,
    memberships: actor.memberships,
  });

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office registration.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.registrationContributionAssessment.update({
      where: {
        id: contributionAssessment.id,
      },
      data: {
        horicReviewedById: actor.id,
        horicReviewNote: input.reviewNote,
        horicReviewedAt: new Date(),
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
        currentDesk: "AREA_MANAGER",
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
        action: "APPROVE",
        reason: [
          `HORIC confirmed contribution: ${contributionAssessment.recommendedAmount.toString()}`,
          input.reviewNote,
        ]
          .filter(Boolean)
          .join(": "),
      },
    });

    return updated;
  });
}

export async function releaseRegistrationContribution(input: ReleaseRegistrationContributionInput) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to release registration contribution.");
  }

  if (
    input.requesterRole !== "AREA_MANAGER" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only Area Manager can release registration contribution.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "AREA_MANAGER",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
      contributionAssessment: {
        is: {
          horicReviewedAt: {
            not: null,
          },
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      areaOfficeId: true,
      contributionAssessment: {
        select: {
          id: true,
          recommendedAmount: true,
        },
      },
    },
  });

  if (!registrationApplication?.contributionAssessment) {
    throw new Error("HORIC-confirmed contribution recommendation was not found.");
  }

  const contributionAssessment = registrationApplication.contributionAssessment;

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess = hasAreaOfficeRegistrationAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: registrationApplication.areaOfficeId,
    memberships: actor.memberships,
  });

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office registration.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.registrationContributionAssessment.update({
      where: {
        id: contributionAssessment.id,
      },
      data: {
        amReleasedById: actor.id,
        amReleaseNote: input.releaseNote,
        releaseChannel: input.releaseChannel,
        amReleasedAt: new Date(),
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
        currentDesk: "COMPANY",
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
        action: "FORWARD",
        reason: [
          `AM released contribution to company: ${contributionAssessment.recommendedAmount.toString()}`,
          `Channel: ${input.releaseChannel}`,
          input.releaseNote,
        ]
          .filter(Boolean)
          .join(": "),
      },
    });

    return updated;
  });
}

export async function uploadRegistrationContributionReceipt(
  input: UploadRegistrationContributionReceiptInput,
) {
  if (!can(input.requesterRole, "registry:submit")) {
    throw new Error("You do not have permission to upload registration payment receipts.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "COMPANY",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
      contributionAssessment: {
        is: {
          amReleasedAt: {
            not: null,
          },
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          id: true,
          organizationId: true,
          legalName: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
      areaOfficeId: true,
      contributionAssessment: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!registrationApplication?.contributionAssessment) {
    throw new Error("A released contribution recommendation was not found for this company.");
  }

  const uploader = await db.user.findUnique({
    where: {
      email: input.uploadedByEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!uploader) {
    throw new Error("Upload user was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    uploader.memberships.some(
      (membership) => membership.organizationId === registrationApplication.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this company's registration receipt.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: registrationApplication.company.id,
    extension: validated.extension,
    mimeType: validated.mimeType,
  });

  return db.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        organizationId: registrationApplication.company.organizationId,
        companyId: registrationApplication.company.id,
        registrationApplicationId: registrationApplication.id,
        uploadedById: uploader.id,
        kind: "CONTRIBUTION_RECEIPT",
        fileName: safeFileName,
        storageProvider: stored.storageProvider,
        scanStatus: stored.scanStatus,
        scannedAt: stored.scannedAt,
        scanReason: stored.scanReason,
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        url: stored.url,
        etag: stored.etag,
        versionId: stored.versionId,
        checksum: stored.checksum,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        access: "PRIVATE",
        classification: "OFFICIAL",
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: uploader.id,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        documentId: document.id,
        action: "SUBMIT",
        reason: "Uploaded registration contribution payment receipt.",
      },
    });

    await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        currentDesk: "AREA_MANAGER",
      },
      select: {
        id: true,
      },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: `registration:${registrationApplication.id}:contribution-receipt-review`,
      },
      create: {
        workspaceId: registrationApplication.company.organization.workspaceId,
        organizationId: registrationApplication.company.organizationId,
        areaOfficeId: registrationApplication.areaOfficeId,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        assignedRole: "AREA_MANAGER",
        app: "REIMBURSEMENT",
        kind: "REGISTRATION_RECEIPT_REVIEW",
        status: "OPEN",
        priority: "HIGH",
        title: "Review registration payment receipt",
        summary: `${registrationApplication.company.legalName} uploaded a contribution payment receipt.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
        sourceKey: `registration:${registrationApplication.id}:contribution-receipt-review`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "HIGH",
        summary: `${registrationApplication.company.legalName} uploaded a contribution payment receipt.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
      },
      select: {
        id: true,
      },
    });

    return document;
  });
}

export async function reviewRegistrationContributionReceipt(
  input: ReviewRegistrationContributionReceiptInput,
) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to review registration payment receipts.");
  }

  if (
    input.requesterRole !== "AREA_MANAGER" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only Area Manager can review registration payment receipts.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "AREA_MANAGER",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
      contributionAssessment: {
        is: {
          amReleasedAt: {
            not: null,
          },
        },
      },
      documents: {
        some: {
          kind: "CONTRIBUTION_RECEIPT",
          isActive: true,
          recordTier: "HOT",
          revokedAt: null,
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      areaOfficeId: true,
    },
  });

  if (!registrationApplication) {
    throw new Error("A receipt awaiting Area Manager review was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess = hasAreaOfficeRegistrationAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: registrationApplication.areaOfficeId,
    memberships: actor.memberships,
  });

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office registration.");
  }

  const accepted = input.action === "accept";

  return db.$transaction(async (tx) => {
    const updated = await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        currentDesk: accepted ? "AREA_MANAGER" : "COMPANY",
        status: accepted ? "IN_REVIEW" : "SUBMITTED",
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
        action: accepted ? "APPROVE" : "REQUEST_CHANGES",
        reason: [
          accepted
            ? "AM accepted registration contribution payment receipt"
            : "AM requested correction on registration contribution payment receipt",
          input.reviewNote,
        ]
          .filter(Boolean)
          .join(": "),
      },
    });

    await tx.workItem.updateMany({
      where: {
        sourceKey: `registration:${registrationApplication.id}:contribution-receipt-review`,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    return updated;
  });
}

export async function notifyRegistrationHeadquarters(
  input: NotifyRegistrationHeadquartersInput,
) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to notify Headquarters for registration.");
  }

  if (
    input.requesterRole !== "AREA_MANAGER" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only Area Manager can notify Headquarters for registration.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "IN_REVIEW",
      currentDesk: "AREA_MANAGER",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
      contributionAssessment: {
        is: {
          amReleasedAt: {
            not: null,
          },
        },
      },
      documents: {
        some: {
          kind: "CONTRIBUTION_RECEIPT",
          isActive: true,
          recordTier: "HOT",
          revokedAt: null,
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      areaOfficeId: true,
      company: {
        select: {
          legalName: true,
          organizationId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!registrationApplication) {
    throw new Error("A payment-verified registration ready for Headquarters was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAreaOfficeAccess = hasAreaOfficeRegistrationAccess({
    requesterEmail: input.requesterEmail,
    requesterRole: input.requesterRole,
    areaOfficeId: registrationApplication.areaOfficeId,
    memberships: actor.memberships,
  });

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office registration.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        currentDesk: "DIRECTOR_FSD",
        status: "IN_REVIEW",
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
        action: "FORWARD",
        reason: ["Area Office notified Headquarters for registration completion", input.note]
          .filter(Boolean)
          .join(": "),
      },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: `registration:${registrationApplication.id}:hq-notification`,
      },
      create: {
        workspaceId: registrationApplication.company.organization.workspaceId,
        organizationId: registrationApplication.company.organizationId,
        areaOfficeId: registrationApplication.areaOfficeId,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        assignedRole: "DIRECTOR_FSD",
        app: "REIMBURSEMENT",
        kind: "REGISTRATION_HQ_NOTIFICATION",
        status: "OPEN",
        priority: "HIGH",
        title: "Process verified employer registration",
        summary: `${registrationApplication.company.legalName} has payment verified by Area Office and is ready for HQ processing.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
        sourceKey: `registration:${registrationApplication.id}:hq-notification`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "HIGH",
        summary: `${registrationApplication.company.legalName} has payment verified by Area Office and is ready for HQ processing.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
      },
      select: {
        id: true,
      },
    });

    return updated;
  });
}

export async function forwardRegistrationToDivision(
  input: ForwardRegistrationToDivisionInput,
) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to forward employer registration.");
  }

  if (
    input.requesterRole !== "DIRECTOR_FSD" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only Director FSD can forward employer registration to the division.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "IN_REVIEW",
      currentDesk: "DIRECTOR_FSD",
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
      company: {
        select: {
          legalName: true,
          organizationId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!registrationApplication) {
    throw new Error("A Headquarters registration awaiting Director FSD forwarding was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        currentDesk: "HEAD_OF_DIVISION",
        status: "IN_REVIEW",
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
        action: "FORWARD",
        reason: [
          "Director FSD forwarded employer registration to Head of Reimbursement Division",
          input.note,
        ]
          .filter(Boolean)
          .join(": "),
      },
    });

    await tx.workItem.updateMany({
      where: {
        sourceKey: `registration:${registrationApplication.id}:hq-notification`,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: `registration:${registrationApplication.id}:hq-division-completion`,
      },
      create: {
        workspaceId: registrationApplication.company.organization.workspaceId,
        organizationId: registrationApplication.company.organizationId,
        areaOfficeId: registrationApplication.areaOfficeId,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        assignedRole: "HEAD_OF_DIVISION",
        app: "REIMBURSEMENT",
        kind: "REGISTRATION_HQ_NOTIFICATION",
        status: "OPEN",
        priority: "HIGH",
        title: "Complete employer registration",
        summary: `${registrationApplication.company.legalName} has been forwarded by Director FSD for registration completion.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
        sourceKey: `registration:${registrationApplication.id}:hq-division-completion`,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        priority: "HIGH",
        summary: `${registrationApplication.company.legalName} has been forwarded by Director FSD for registration completion.`,
        targetHref: `/registry/${registrationApplication.companyId}`,
      },
      select: {
        id: true,
      },
    });

    return updated;
  });
}

export async function completeRegistrationAtHeadquarters(
  input: CompleteRegistrationAtHeadquartersInput,
) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to complete employer registration.");
  }

  if (
    input.requesterRole !== "HEAD_OF_DIVISION" &&
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN"
  ) {
    throw new Error("Only Head of Reimbursement Division can complete employer registration.");
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "IN_REVIEW",
      currentDesk: "HEAD_OF_DIVISION",
      company: {
        id: input.companyId,
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          id: true,
          legalName: true,
          organizationId: true,
          itfEmployerNumber: true,
          status: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!registrationApplication) {
    throw new Error("A Headquarters registration awaiting completion was not found.");
  }

  if (
    registrationApplication.company.itfEmployerNumber ||
    registrationApplication.company.status === "ACTIVE"
  ) {
    throw new Error("This company is already registered with ITF. Annual compliance should be used after registration.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const completedAt = new Date();
  const complianceYear = completedAt.getFullYear();

  return db.$transaction(async (tx) => {
    const itfManagedNumber = await tx.managedRegistrationNumber.findFirst({
      where: {
        id: input.itfEmployerNumberId,
        workspaceId: registrationApplication.company.organization.workspaceId,
        type: "ITF_EMPLOYER_NUMBER",
        status: "AVAILABLE",
        recordTier: "HOT",
      },
      select: {
        id: true,
        value: true,
      },
    });

    if (!itfManagedNumber) {
      throw new Error("Selected ITF employer number is no longer available.");
    }

    const itfEmployerNumber = itfManagedNumber.value;

    await tx.company.update({
      where: {
        id: registrationApplication.companyId,
      },
      data: {
        itfEmployerNumber,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    const updated = await tx.registrationApplication.update({
      where: {
        id: registrationApplication.id,
      },
      data: {
        status: "APPROVED",
        completedAt,
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
        action: "CERTIFY",
        reason: [
          `HQ completed registration with ITF employer number: ${itfEmployerNumber}`,
          `Opened ${complianceYear} annual compliance filing`,
          input.note,
        ]
          .filter(Boolean)
          .join(": "),
      },
    });

    await tx.complianceYear.upsert({
      where: {
        companyId_year: {
          companyId: registrationApplication.companyId,
          year: complianceYear,
        },
      },
      create: {
        companyId: registrationApplication.companyId,
        year: complianceYear,
        status: "DRAFT",
      },
      update: {},
    });

    const itfNumberAssignment = await tx.managedRegistrationNumber.updateMany({
      where: {
        id: itfManagedNumber.id,
        status: "AVAILABLE",
      },
      data: {
        status: "ASSIGNED",
        assignedCompanyId: registrationApplication.companyId,
        issuedById: actor.id,
        issuedAt: completedAt,
      },
    });

    if (itfNumberAssignment.count !== 1) {
      throw new Error("Selected ITF employer number could not be assigned.");
    }

    await tx.workItem.updateMany({
      where: {
        sourceKey: {
          in: [
            `registration:${registrationApplication.id}:hq-notification`,
            `registration:${registrationApplication.id}:hq-division-completion`,
          ],
        },
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    return updated;
  });
}

export async function recordLegacyRegistration(input: RecordLegacyRegistrationInput) {
  if (!can(input.requesterRole, "registry:review") && !can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to record legacy employer registration.");
  }

  if (!canRecordLegacyRegistration(input.requesterRole)) {
    throw new Error(
      "Only authorized Headquarters, Area Office Revenue Accountant, or system administrators can record legacy registration.",
    );
  }

  const itfEmployerNumber = input.itfEmployerNumber.trim();
  const note = input.note.trim();

  if (!itfEmployerNumber) {
    throw new Error("ITF employer number is required.");
  }

  if (!note) {
    throw new Error("A legacy onboarding note is required.");
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
      legalName: true,
      organizationId: true,
      areaOfficeId: true,
      itfEmployerNumber: true,
      status: true,
      organization: {
        select: {
          workspaceId: true,
        },
      },
      registrationApplication: {
        select: {
          id: true,
          status: true,
          currentDesk: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  if (company.itfEmployerNumber || company.status === "ACTIVE") {
    throw new Error("This company already has ITF registration recorded.");
  }

  if (input.requesterRole === "REVENUE_ACCOUNTANT" && !company.areaOfficeId) {
    throw new Error("Select the company's Area Office before Revenue Accountant legacy onboarding.");
  }

  if (
    company.registrationApplication &&
    company.registrationApplication.status !== "DRAFT" &&
    company.registrationApplication.status !== "CHANGES_REQUESTED"
  ) {
    throw new Error(
      "This company already has an active registration workflow. Complete or resolve that workflow instead.",
    );
  }

  const [actor, duplicateCompany] = await Promise.all([
    db.user.findUnique({
      where: {
        email: input.requesterEmail,
      },
      select: {
        id: true,
        memberships: {
          where: { isActive: true },
          select: {
            areaOfficeId: true,
          },
        },
      },
    }),
    db.company.findFirst({
      where: {
        id: {
          not: company.id,
        },
        itfEmployerNumber,
        recordTier: "HOT",
      },
      select: {
        legalName: true,
      },
    }),
  ]);

  if (!actor) {
    throw new Error("User account was not found.");
  }

  if (
    input.requesterRole === "REVENUE_ACCOUNTANT" &&
    !actor.memberships.some((membership) => membership.areaOfficeId === company.areaOfficeId)
  ) {
    throw new Error(
      "Revenue Accountant can only onboard legacy employers in their assigned Area Office.",
    );
  }

  if (duplicateCompany) {
    throw new Error(
      `ITF employer number is already recorded for ${duplicateCompany.legalName}.`,
    );
  }

  const recordedAt = new Date();
  const complianceYear = recordedAt.getFullYear();

  return db.$transaction(async (tx) => {
    await tx.company.update({
      where: {
        id: company.id,
      },
      data: {
        itfEmployerNumber,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (company.registrationApplication) {
      await tx.registrationApplication.update({
        where: {
          id: company.registrationApplication.id,
        },
        data: {
          status: "APPROVED",
          currentDesk: "COMPANY",
          completedAt: recordedAt,
        },
        select: {
          id: true,
        },
      });
    }

    await tx.complianceYear.upsert({
      where: {
        companyId_year: {
          companyId: company.id,
          year: complianceYear,
        },
      },
      create: {
        companyId: company.id,
        year: complianceYear,
        status: "DRAFT",
      },
      update: {},
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: company.id,
        registrationApplicationId: company.registrationApplication?.id,
        action: "CERTIFY",
        reason: [
          `Recorded legacy ITF employer number: ${itfEmployerNumber}`,
          `Opened ${complianceYear} annual compliance filing`,
          note,
        ].join(": "),
      },
    });

    if (company.registrationApplication) {
      await tx.workItem.updateMany({
        where: {
          registrationApplicationId: company.registrationApplication.id,
          status: {
            in: ["OPEN", "ACKNOWLEDGED"],
          },
        },
        data: {
          status: "RESOLVED",
          resolvedAt: recordedAt,
        },
      });
    }

    return {
      companyId: company.id,
      complianceYear,
      itfEmployerNumber,
    };
  });
}

export async function reviewLegacyRegistrationClaim(input: ReviewLegacyRegistrationClaimInput) {
  if (!can(input.requesterRole, "registry:review")) {
    throw new Error("You do not have permission to review legacy employer registration.");
  }

  if (!canRecordLegacyRegistration(input.requesterRole)) {
    throw new Error(
      "Only Revenue Accountant, authorized Headquarters, or system administrators can review legacy registration claims.",
    );
  }

  const db = getDb();
  const registrationApplication = await db.registrationApplication.findFirst({
    where: {
      companyId: input.companyId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "REVENUE_ACCOUNTANT",
      registrationKind: "LEGACY_EMPLOYER",
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
      claimedItfEmployerNumber: true,
      company: {
        select: {
          id: true,
          legalName: true,
          organizationId: true,
          itfEmployerNumber: true,
          status: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!registrationApplication) {
    throw new Error("A legacy registration claim awaiting Revenue Accountant review was not found.");
  }

  const claimedItfEmployerNumber = registrationApplication.claimedItfEmployerNumber?.trim();

  if (!claimedItfEmployerNumber) {
    throw new Error("Legacy registration claim does not include an ITF employer number.");
  }

  if (
    registrationApplication.company.itfEmployerNumber ||
    registrationApplication.company.status === "ACTIVE"
  ) {
    throw new Error("This company already has ITF registration recorded.");
  }

  const [actor, duplicateCompany] = await Promise.all([
    db.user.findUnique({
      where: {
        email: input.requesterEmail,
      },
      select: {
        id: true,
        memberships: {
          where: { isActive: true },
          select: {
            areaOfficeId: true,
          },
        },
      },
    }),
    input.action === "validate"
      ? db.company.findFirst({
          where: {
            id: {
              not: registrationApplication.company.id,
            },
            itfEmployerNumber: claimedItfEmployerNumber,
            recordTier: "HOT",
          },
          select: {
            legalName: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const isHeadquartersOverride =
    input.requesterRole === "DIRECTOR_FSD" || input.requesterRole === "HEAD_OF_DIVISION";
  const hasAreaOfficeAccess =
    isHeadquartersOverride ||
    hasAreaOfficeRegistrationAccess({
      requesterEmail: input.requesterEmail,
      requesterRole: input.requesterRole,
      areaOfficeId: registrationApplication.areaOfficeId,
      memberships: actor.memberships,
    });

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to this Area Office legacy registration claim.");
  }

  if (duplicateCompany) {
    throw new Error(
      `ITF employer number is already recorded for ${duplicateCompany.legalName}.`,
    );
  }

  const reviewedAt = new Date();
  const complianceYear = reviewedAt.getFullYear();
  const actionReason = [
    input.action === "validate"
      ? `Validated legacy ITF employer number: ${claimedItfEmployerNumber}`
      : input.action === "request_changes"
        ? "Requested correction on legacy ITF registration claim"
        : `Rejected legacy ITF employer number claim: ${claimedItfEmployerNumber}`,
    input.action === "validate" ? `Opened ${complianceYear} annual compliance filing` : undefined,
    input.note,
  ]
    .filter(Boolean)
    .join(": ");

  return db.$transaction(async (tx) => {
    if (input.action === "validate") {
      await tx.company.update({
        where: {
          id: registrationApplication.companyId,
        },
        data: {
          itfEmployerNumber: claimedItfEmployerNumber,
          status: "ACTIVE",
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
          status: "APPROVED",
          currentDesk: "COMPANY",
          correctionReturnDesk: null,
          completedAt: reviewedAt,
        },
        select: {
          id: true,
        },
      });

      await tx.complianceYear.upsert({
        where: {
          companyId_year: {
            companyId: registrationApplication.companyId,
            year: complianceYear,
          },
        },
        create: {
          companyId: registrationApplication.companyId,
          year: complianceYear,
          status: "DRAFT",
        },
        update: {},
      });
    } else if (input.action === "request_changes") {
      await tx.registrationApplication.update({
        where: {
          id: registrationApplication.id,
        },
        data: {
          status: "CHANGES_REQUESTED",
          currentDesk: "COMPANY",
          correctionReturnDesk: "REVENUE_ACCOUNTANT",
        },
        select: {
          id: true,
        },
      });
    } else {
      await tx.company.update({
        where: {
          id: registrationApplication.companyId,
        },
        data: {
          status: "REJECTED",
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
          status: "REJECTED",
          currentDesk: "COMPANY",
          correctionReturnDesk: null,
          completedAt: reviewedAt,
        },
        select: {
          id: true,
        },
      });
    }

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: registrationApplication.companyId,
        registrationApplicationId: registrationApplication.id,
        action:
          input.action === "validate"
            ? "CERTIFY"
            : input.action === "request_changes"
              ? "REQUEST_CHANGES"
              : "REJECT",
        reason: actionReason,
      },
    });

    await tx.workItem.updateMany({
      where: {
        registrationApplicationId: registrationApplication.id,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: reviewedAt,
      },
    });

    return {
      companyId: registrationApplication.companyId,
      action: input.action,
      itfEmployerNumber: claimedItfEmployerNumber,
    };
  });
}
