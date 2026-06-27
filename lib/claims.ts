import { getDb } from "@/lib/db";
import { isLateClaimSubmission } from "@/lib/claim-policy";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { can, isItfRole, type Role } from "@/lib/rbac";
import {
  calculateReimbursementAward,
  type ReimbursementCalculationInput,
  type ReimbursementAwardArea,
} from "@/lib/reimbursement-calculation";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const claimEvidenceKinds = [
  "ATTENDANCE_SHEET",
  "PAYMENT_RECEIPT",
  "TRAINING_REPORT",
  "TRAINING_PHOTO",
  "CERTIFICATE",
  "OTHER_SUPPORTING_EVIDENCE",
] as const;

export type ClaimEvidenceKind = (typeof claimEvidenceKinds)[number];

export type CreateClaimInput = {
  trainingRequestIds: string[];
  requesterEmail: string;
  requesterRole: Role;
};

export type UpdateClaimTrainingsInput = {
  claimId: string;
  trainingRequestIds: string[];
  requesterEmail: string;
  requesterRole: Role;
};

export type UpdateClaimFormInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  claimYear?: number;
  trainingContributionDue?: number;
  trainingContributionPaid?: number;
  itfReceiptNumber?: string;
  bankName?: string;
  accountNumber?: string;
  sortCode?: string;
  claimedAmount: number;
  employerOfficerName?: string;
  employerOfficerRank?: string;
  chiefExecutiveName?: string;
};

export type UploadClaimEvidenceInput = {
  claimId: string;
  uploadedByEmail: string;
  requesterRole: Role;
  kind: ClaimEvidenceKind;
  file: File;
};

export type UpdateClaimRecommendationInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  eligibleAmount?: number;
  claimRecommendedAmount?: number;
  claimRecommendedInWords?: string;
  reviewerRemarks?: string;
};

export type ClaimLineInput = {
  claimId: string;
  lineId?: string;
  requesterEmail: string;
  requesterRole: Role;
  trainingArea: string;
  totalWorkforce?: number;
  totalTrained?: number;
  emphasisNumber?: number;
  contributionPaid?: number;
  employerClaimAmount?: number;
  referencePage?: string;
  percentAwarded?: number;
  amountAwarded?: number;
  remarks?: string;
};

export type UpdateEmployerClaimCalculationInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  calculation: ReimbursementCalculationInput;
};

export function getClaimEvidenceKinds() {
  return claimEvidenceKinds;
}

export async function createClaim(input: CreateClaimInput) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to create reimbursement claims.");
  }

  const trainingRequestIds = [...new Set(input.trainingRequestIds)];

  if (trainingRequestIds.length === 0) {
    throw new Error("Select at least one approved training for the claim.");
  }

  const db = getDb();
  const requests = await db.trainingRequest.findMany({
    where: {
      id: {
        in: trainingRequestIds,
      },
      status: "APPROVED",
      decisionOutcome: "ACCEPTED",
      recordTier: "HOT",
      claimAttachments: {
        none: {},
      },
      monitoringRecords: {
        some: {
          status: "APPROVED",
          decisionOutcome: "ACCEPTED",
          recordTier: "HOT",
        },
      },
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      startsAt: true,
      estimatedCost: true,
      company: {
        select: {
          organizationId: true,
          itfEmployerNumber: true,
          organization: {
            select: {
              workspaceId: true,
              workspace: {
                select: {
                  allowLateClaimSubmissions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (requests.length !== trainingRequestIds.length) {
    throw new Error(
      "Claims can only include available, approved, and monitored Training Approval Requests.",
    );
  }

  const companyIds = new Set(requests.map((request) => request.companyId));

  if (companyIds.size !== 1) {
    throw new Error("All trainings attached to a claim must belong to the same company.");
  }

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

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === requests[0].company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to create a claim for these trainings.");
  }

  const trainingYears = new Set(requests.map((request) => request.startsAt.getFullYear()));
  if (trainingYears.size !== 1) {
    throw new Error("A reimbursement claim must belong to one training year.");
  }

  const claimYear = requests[0].startsAt.getFullYear();
  if (
    isLateClaimSubmission(claimYear) &&
    !requests[0].company.organization.workspace.allowLateClaimSubmissions
  ) {
    throw new Error(
      `Claims for the ${claimYear} training year closed on 30 June ${claimYear + 1}.`,
    );
  }

  const claimedAmount = requests.reduce(
    (total, request) => total + Number(request.estimatedCost.toString()),
    0,
  );
  const referenceDate = requests.reduce(
    (latest, request) => (request.startsAt > latest ? request.startsAt : latest),
    requests[0].startsAt,
  );

  return db.reimbursementClaim.create({
    data: {
      companyId: requests[0].companyId,
      reference: buildClaimReference(referenceDate),
      claimYear,
      itfReceiptNumber: requests[0].company.itfEmployerNumber,
      claimedAmount,
      status: "DRAFT",
      trainingRequests: {
        create: trainingRequestIds.map((trainingRequestId) => ({
          trainingRequestId,
        })),
      },
    },
    select: {
      id: true,
    },
  });
}

function buildClaimReference(date: Date) {
  return `TR-${date.getFullYear()}-${Date.now()}`;
}

export async function attachTrainingsToClaim(input: UpdateClaimTrainingsInput) {
  const trainingRequestIds = [...new Set(input.trainingRequestIds)];

  if (trainingRequestIds.length === 0) {
    throw new Error("Select at least one approved training to attach.");
  }

  const claim = await assertClaimTrainingAccess(input);
  const db = getDb();
  const requests = await db.trainingRequest.findMany({
    where: {
      id: {
        in: trainingRequestIds,
      },
      companyId: claim.companyId,
      status: "APPROVED",
      decisionOutcome: "ACCEPTED",
      recordTier: "HOT",
      claimAttachments: {
        none: {},
      },
      monitoringRecords: {
        some: {
          status: "APPROVED",
          decisionOutcome: "ACCEPTED",
          recordTier: "HOT",
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (requests.length !== trainingRequestIds.length) {
    throw new Error("One or more selected trainings are no longer available for reimbursement.");
  }

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      trainingRequests: {
        create: trainingRequestIds.map((trainingRequestId) => ({
          trainingRequestId,
        })),
      },
    },
    select: {
      id: true,
    },
  });
}

export async function detachTrainingFromClaim(
  input: {
    claimId: string;
    trainingRequestId: string;
    requesterEmail: string;
    requesterRole: Role;
  },
) {
  const claim = await assertClaimTrainingAccess(input);
  const db = getDb();
  const attachment = await db.reimbursementClaimTraining.findUnique({
    where: {
      trainingRequestId: input.trainingRequestId,
    },
    select: {
      reimbursementClaimId: true,
    },
  });

  if (!attachment || attachment.reimbursementClaimId !== claim.id) {
    throw new Error("The selected training is not attached to this claim.");
  }

  const attachmentCount = await db.reimbursementClaimTraining.count({
    where: {
      reimbursementClaimId: claim.id,
    },
  });

  if (attachmentCount <= 1) {
    throw new Error("A reimbursement claim must retain at least one approved training.");
  }

  return db.reimbursementClaimTraining.delete({
    where: {
      trainingRequestId: input.trainingRequestId,
    },
    select: {
      id: true,
    },
  });
}

async function assertClaimTrainingAccess(input: {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to manage claim trainings.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      status: "DRAFT",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Editable reimbursement claim was not found.");
  }

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

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to manage trainings on this claim.");
  }

  return claim;
}

export async function updateClaimForm(input: UpdateClaimFormInput) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to update reimbursement claims.");
  }

  if (!Number.isFinite(input.claimedAmount) || input.claimedAmount <= 0) {
    throw new Error("Claimed amount must be greater than zero.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      status: "DRAFT",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Editable reimbursement claim was not found.");
  }

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

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to update this claim.");
  }

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      claimYear: input.claimYear,
      trainingContributionDue: input.trainingContributionDue,
      trainingContributionPaid: input.trainingContributionPaid,
      itfReceiptNumber: input.itfReceiptNumber,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      sortCode: input.sortCode,
      claimedAmount: input.claimedAmount,
      employerOfficerName: input.employerOfficerName,
      employerOfficerRank: input.employerOfficerRank,
      chiefExecutiveName: input.chiefExecutiveName,
      employerDeclaredAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}

export async function uploadClaimEvidence(input: UploadClaimEvidenceInput) {
  if (!can(input.requesterRole, "claims:submit") && !can(input.requesterRole, "claims:review")) {
    throw new Error("You do not have permission to upload claim evidence.");
  }

  await assertUploadRateLimit(input.uploadedByEmail);

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  const actor = await db.user.findUnique({
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

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to upload evidence for this claim.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const safeFileName = sanitizeFileName(input.file.name);
  const validated = validateUpload(buffer, safeFileName, input.file.type);
  const stored = await uploadObject({
    buffer,
    companyId: claim.companyId,
    extension: validated.extension,
    mimeType: validated.mimeType,
    namespace: "claims",
  });

  return db.document.create({
    data: {
      organizationId: claim.company.organizationId,
      companyId: claim.companyId,
      reimbursementClaimId: claim.id,
      uploadedById: actor.id,
      kind: input.kind,
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
}

export async function updateClaimRecommendation(input: UpdateClaimRecommendationInput) {
  if (!can(input.requesterRole, "claims:review")) {
    throw new Error("You do not have permission to recommend reimbursement claims.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
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

  const hasAreaOfficeAccess =
    input.requesterRole === "SYSTEM_ADMIN" ||
    input.requesterRole === "WORKSPACE_APP_ADMIN" ||
    input.requesterRole === "HEAD_OF_DIVISION" ||
    input.requesterRole === "DIRECTOR_FSD" ||
    input.requesterRole === "HQ_REIMBURSEMENT_OFFICER" ||
    actor.memberships.some((membership) => membership.areaOfficeId === claim.company.areaOfficeId);

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to recommend this Area Office claim.");
  }

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      eligibleAmount: input.eligibleAmount,
      claimRecommendedAmount: input.claimRecommendedAmount,
      claimRecommendedInWords: input.claimRecommendedInWords,
      paymentDetails: input.reviewerRemarks,
    },
    select: {
      id: true,
    },
  });
}

export async function updateEmployerClaimCalculation(input: UpdateEmployerClaimCalculationInput) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to update reimbursement claim calculations.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      status: "DRAFT",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Editable reimbursement claim was not found.");
  }

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

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to update this claim calculation.");
  }

  const result = calculateReimbursementAward(input.calculation);
  const lines = result.lines.map((line) =>
    buildEmployerCalculationLine(
      line,
      input.calculation.trainingContributionPaid,
      input.calculation,
    ),
  );

  return db.$transaction(async (tx) => {
    await tx.reimbursementClaimLine.deleteMany({
      where: {
        reimbursementClaimId: claim.id,
        stage: "EMPLOYER",
      },
    });

    await tx.reimbursementClaim.update({
      where: {
        id: claim.id,
      },
      data: {
        employerScale: input.calculation.employerScale,
        trainingContributionPaid: input.calculation.trainingContributionPaid,
        claimedAmount: result.totalAmountAwarded,
        uncappedAwardPercent: result.uncappedTotalAwardPercent,
        cappedAwardPercent: result.cappedTotalAwardPercent,
        calculatedAwardAmount: result.totalAmountAwarded,
        lines: {
          create: lines,
        },
      },
      select: {
        id: true,
      },
    });

    return {
      id: claim.id,
    };
  });
}

export async function addClaimLine(input: ClaimLineInput) {
  const claim = await assertClaimLineAccess(input);

  return getDb().reimbursementClaimLine.create({
    data: buildClaimLineData(input, claim.id),
    select: {
      id: true,
    },
  });
}

export async function updateClaimLine(input: ClaimLineInput) {
  if (!input.lineId) {
    throw new Error("Claim calculation row is required.");
  }

  const claim = await assertClaimLineAccess(input);

  return getDb().reimbursementClaimLine.update({
    where: {
      id: input.lineId,
      reimbursementClaimId: claim.id,
    },
    data: buildClaimLineData(input, claim.id),
    select: {
      id: true,
    },
  });
}

export async function deleteClaimLine(input: {
  claimId: string;
  lineId: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  const claim = await assertClaimLineAccess(input);

  return getDb().reimbursementClaimLine.delete({
    where: {
      id: input.lineId,
      reimbursementClaimId: claim.id,
    },
    select: {
      id: true,
    },
  });
}

async function assertClaimLineAccess(input: {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
}) {
  if (!can(input.requesterRole, "claims:submit") && !can(input.requesterRole, "claims:review")) {
    throw new Error("You do not have permission to edit claim calculations.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          organizationId: true,
          areaOfficeId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
          areaOfficeId: true,
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAccess =
    isItfRole(input.requesterRole) ||
    actor.memberships.some(
      (membership) =>
        membership.organizationId === claim.company.organizationId ||
        membership.areaOfficeId === claim.company.areaOfficeId,
    );

  if (!hasAccess) {
    throw new Error("You do not have access to edit this claim calculation.");
  }

  return claim;
}

function buildClaimLineData(input: ClaimLineInput, claimId: string) {
  const percentTrained =
    input.totalWorkforce && input.totalTrained
      ? (input.totalTrained / input.totalWorkforce) * 100
      : undefined;

  return {
    reimbursementClaimId: claimId,
    trainingArea: input.trainingArea,
    totalWorkforce: input.totalWorkforce,
    totalTrained: input.totalTrained,
    percentTrained,
    emphasisNumber: input.emphasisNumber,
    contributionPaid: input.contributionPaid,
    employerClaimAmount: input.employerClaimAmount,
    referencePage: input.referencePage,
    percentAwarded: input.percentAwarded,
    amountAwarded: input.amountAwarded,
    remarks: input.remarks,
  };
}

function buildEmployerCalculationLine(
  line: {
    area: ReimbursementAwardArea;
    percentTrained?: number;
    awardPercent: number;
    amountAwarded: number;
  },
  trainingContributionPaid: number,
  calculation: ReimbursementCalculationInput,
) {
  const counts = getCalculationLineCounts(line.area, calculation);

  return {
    stage: "EMPLOYER" as const,
    awardArea: line.area,
    trainingArea: formatAwardArea(line.area),
    totalWorkforce: counts.totalWorkforce,
    totalTrained: counts.totalTrained,
    percentTrained: line.percentTrained,
    emphasisNumber: getCalculationLineEmphasisNumber(line.area, calculation),
    contributionPaid: trainingContributionPaid,
    employerClaimAmount: line.amountAwarded,
    percentAwarded: line.awardPercent,
    amountAwarded: line.amountAwarded,
  };
}

function formatAwardArea(area: ReimbursementAwardArea) {
  const labels: Record<ReimbursementAwardArea, string> = {
    MANAGEMENT: "Management",
    SUPERVISORY: "Supervisory",
    OCCUPATIONAL: "Occupational",
    SMALL_SCALE_TRAINING: "Small Scale Training",
    LEARNING_DEVELOPMENT_PERSONNEL: "Learning & Development Personnel",
    HEALTH_SAFETY_ENVIRONMENT: "Health, Safety & Environment",
    SIWES: "SIWES",
    TRAINING_PLAN: "Training Plan",
  };

  return labels[area];
}

function getCalculationLineCounts(
  area: ReimbursementAwardArea,
  calculation: ReimbursementCalculationInput,
) {
  if (calculation.employerScale === "SMALL") {
    if (area === "SMALL_SCALE_TRAINING") {
      return {
        totalWorkforce: calculation.smallScaleTraining.totalStaff,
        totalTrained: calculation.smallScaleTraining.totalTrained,
      };
    }

    if (area === "SIWES") {
      return {
        totalWorkforce: undefined,
        totalTrained: calculation.siwesStudentsAccepted,
      };
    }

    return {
      totalWorkforce: undefined,
      totalTrained: undefined,
    };
  }

  if (area === "MANAGEMENT" || area === "SUPERVISORY" || area === "OCCUPATIONAL") {
    return {
      totalWorkforce: calculation.trainingAreas[area].totalStaff,
      totalTrained: calculation.trainingAreas[area].totalTrained,
    };
  }

  if (area === "LEARNING_DEVELOPMENT_PERSONNEL" && calculation.learningDevelopmentPersonnel) {
    return {
      totalWorkforce: calculation.learningDevelopmentPersonnel.totalStaff,
      totalTrained: calculation.learningDevelopmentPersonnel.totalTrained,
    };
  }

  if (area === "HEALTH_SAFETY_ENVIRONMENT" && calculation.healthSafetyEnvironment) {
    return {
      totalWorkforce: calculation.healthSafetyEnvironment.totalWorkforce,
      totalTrained: calculation.healthSafetyEnvironment.totalTrained,
    };
  }

  if (area === "SIWES") {
    return {
      totalWorkforce: undefined,
      totalTrained: calculation.siwesStudentsAccepted,
    };
  }

  return {
    totalWorkforce: undefined,
    totalTrained: undefined,
  };
}

function getCalculationLineEmphasisNumber(
  area: ReimbursementAwardArea,
  calculation: ReimbursementCalculationInput,
) {
  if (
    calculation.employerScale === "MEDIUM_LARGE" &&
    (area === "MANAGEMENT" || area === "SUPERVISORY" || area === "OCCUPATIONAL")
  ) {
    return calculation.emphasisRanks[area];
  }

  return undefined;
}
