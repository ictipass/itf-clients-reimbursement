import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

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

const recommendationReleaseChannels = ["DASHBOARD", "DASHBOARD_AND_EMAIL"] as const;

type RecommendationReleaseChannel = (typeof recommendationReleaseChannels)[number];

export function getRecommendationReleaseChannels() {
  return recommendationReleaseChannels;
}

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
        },
      },
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

    return document;
  });
}
