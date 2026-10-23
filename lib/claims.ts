import { getDb } from "@/lib/db";
import { nairaInWords } from "@/lib/naira-in-words";
import { applyAreaOfficeVerifiedCounts, getAreaOfficeCalculationBaseline, type AreaOfficeVerifiedCounts } from "@/lib/area-office-claim-calculation";
import { verifyAnnualEligibility } from "@/lib/annual-eligibility";
import {
  formatContributionVerificationSource,
  formatContributionVerificationStatus,
  isContributionVerificationSource,
  isContributionVerificationStatus,
  type ContributionVerificationSource,
  type ContributionVerificationStatus,
} from "@/lib/claim-verification";
import { isLateClaimSubmission } from "@/lib/claim-policy";
import { getClaimFilingClock } from "@/lib/claim-test-clock";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { can, isItfRole, type Role } from "@/lib/rbac";
import {
  isReimbursementAuditReviewStatus,
  type ReimbursementAuditReviewStatus,
} from "@/lib/reimbursement-audit-review";
import {
  calculateReimbursementAward,
  type ReimbursementCalculationInput,
  type ReimbursementAwardArea,
} from "@/lib/reimbursement-calculation";
import {
  prepareClaimStaffEntries,
  type ReimbursementStaffEntryInput,
} from "@/lib/reimbursement-staff";
import {
  buildReimbursementPaymentScheduleReference,
  isReimbursementPaymentHandoffStatus,
  type ReimbursementPaymentHandoffStatus,
} from "@/lib/reimbursement-payment-schedule";
import { uploadObject } from "@/lib/storage";
import { sanitizeFileName, validateUpload } from "@/lib/storage/security";

const claimEvidenceKinds = [
  "ATTENDANCE_SHEET",
  "PAYMENT_RECEIPT",
  "TRAINING_REPORT",
  "TRAINING_PHOTO",
  "SIWES_FORM_5A",
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
  bankId?: string;
  accountNumber?: string;
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

export type CalculateAreaOfficeClaimInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  verified: AreaOfficeVerifiedCounts;
  reviewerRemarks: string;
  reviewedForm1A: boolean;
  reviewedForm2A: boolean;
  reviewedEvidence: boolean;
};

export type CalculateHeadquartersClaimInput = CalculateAreaOfficeClaimInput;

export type UpdateClaimContributionVerificationInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  status: ContributionVerificationStatus;
  source: ContributionVerificationSource;
  note?: string;
  externalVerificationProvider?: string;
  externalVerificationReference?: string;
  externalVerificationMessage?: string;
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

export type UpdateClaimStaffEntriesInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  entries: ReimbursementStaffEntryInput[];
};

export type ClaimRoutingInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  note?: string;
};

export type ClaimWorkflowRoutingInput = ClaimRoutingInput & {
  fromDesk: ClaimDesk;
  toDesk: ClaimDesk;
};

export async function recheckClaimAnnualPayment(input: ClaimRoutingInput) {
  if (!isItfRole(input.requesterRole)) {
    throw new Error("Only ITF processing officers can recheck annual payment.");
  }
  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", company: { isActive: true, recordTier: "HOT" } },
    select: { companyId: true, claimYear: true, company: { select: { areaOfficeId: true } } },
  });
  if (!claim) throw new Error("Reimbursement claim was not found.");

  if (["AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"].includes(input.requesterRole)) {
    const membership = await db.membership.findFirst({
      where: {
        user: { email: input.requesterEmail, isActive: true },
        isActive: true,
        role: input.requesterRole,
        areaOfficeId: claim.company.areaOfficeId ?? "__no_area_office__",
      },
      select: { id: true },
    });
    if (!membership) throw new Error("You do not have Area Office access for this claim.");
  }

  return verifyAnnualEligibility(claim.companyId, claim.claimYear ?? 0);
}

export type UpdateClaimPaymentHandoffInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  status: ReimbursementPaymentHandoffStatus;
  paymentSystemReference?: string;
  paymentSystemStatus?: string;
  note?: string;
};

export type UpdateClaimAuditReviewInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  status: ReimbursementAuditReviewStatus;
  observations?: string;
  recommendation?: string;
  auditedAmount?: number;
  varianceAmount?: number;
};

export type ClaimDesk =
  | "COMPANY"
  | "AREA_MANAGER"
  | "HEAD_OF_TRAINING"
  | "REIMBURSEMENT_OFFICER"
  | "DIRECTOR_FSD"
  | "HEAD_OF_DIVISION"
  | "HQ_REIMBURSEMENT_OFFICER"
  | "DIRECTOR_AUDIT"
  | "HEAD_REIMBURSEMENT_AUDIT"
  | "REIMBURSEMENT_SCHEDULE_AUDITOR"
  | "HEAD_BUDGET"
  | "BUDGET_OFFICER"
  | "PRE_AUDIT_OFFICER"
  | "DIRECTOR_FINANCE"
  | "HEAD_REIMBURSEMENT_FINANCE"
  | "REIMBURSEMENT_ACCOUNTANT";

type ClaimRoutingTransition = {
  from: ClaimDesk;
  to: ClaimDesk;
  assignedRole: Role;
  action: "SUBMIT" | "FORWARD" | "RECOMMEND" | "APPROVE";
  reason: string;
  workItemTitle: string;
  workItemSummary: string;
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
                  activeReimbursementEdition: true,
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
  const filingDate = getClaimFilingClock().now;
  const filingYear = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric" }).format(filingDate));
  if (filingYear < claimYear + 1) {
    throw new Error(`Training held in ${claimYear} can first be claimed in ${claimYear + 1}.`);
  }
  if (
    isLateClaimSubmission(claimYear, filingDate) &&
    !requests[0].company.organization.workspace.allowLateClaimSubmissions
  ) {
    throw new Error(
      `Claims for the ${claimYear} training year closed on 30 June ${claimYear + 1}.`,
    );
  }

  const eligibility = await verifyAnnualEligibility(requests[0].companyId, claimYear);
  if (eligibility.status !== "ELIGIBLE") {
    throw new Error(`Annual payment must be confirmed before a claim can be created: ${eligibility.message}`);
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
      policyEdition: requests[0].company.organization.workspace.activeReimbursementEdition,
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

export function getClaimIntakeTransitions() {
  return [
    {
      from: "COMPANY",
      to: "AREA_MANAGER",
      assignedRole: "AREA_MANAGER",
      action: "SUBMIT",
      reason: "Employer submitted reimbursement claim to Area Manager.",
      workItemTitle: "Review submitted reimbursement claim",
      workItemSummary: "submitted a reimbursement claim for Area Manager intake.",
    },
    {
      from: "AREA_MANAGER",
      to: "HEAD_OF_TRAINING",
      assignedRole: "HEAD_OF_TRAINING",
      action: "FORWARD",
      reason: "Area Manager forwarded reimbursement claim to HOT.",
      workItemTitle: "Review reimbursement claim from Area Manager",
      workItemSummary: "has a reimbursement claim awaiting HOT review.",
    },
    {
      from: "HEAD_OF_TRAINING",
      to: "REIMBURSEMENT_OFFICER",
      assignedRole: "REIMBURSEMENT_OFFICER",
      action: "FORWARD",
      reason: "HOT forwarded reimbursement claim to A/O Reimbursement Officer.",
      workItemTitle: "Process reimbursement claim",
      workItemSummary: "has a reimbursement claim awaiting A/O Reimbursement Officer processing.",
    },
  ] as const satisfies readonly ClaimRoutingTransition[];
}

export function getClaimPostIntakeTransitions() {
  return [
    {
      from: "REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_TRAINING",
      assignedRole: "HEAD_OF_TRAINING",
      action: "FORWARD",
      reason: "A/O Reimbursement Officer forwarded processed claim to HOT.",
      workItemTitle: "Verify A/O reimbursement recommendation",
      workItemSummary: "has a processed reimbursement claim awaiting HOT verification.",
    },
    {
      from: "HEAD_OF_TRAINING",
      to: "AREA_MANAGER",
      assignedRole: "AREA_MANAGER",
      action: "RECOMMEND",
      reason: "HOT reviewed the Area Office RO calculation and recommended the claim to Area Manager.",
      workItemTitle: "Release processed reimbursement claim",
      workItemSummary: "has a processed reimbursement claim awaiting Area Manager release.",
    },
    {
      from: "AREA_MANAGER",
      to: "DIRECTOR_FSD",
      assignedRole: "DIRECTOR_FSD",
      action: "APPROVE",
      reason: "Area Manager approved the Area Office reimbursement recommendation and forwarded the claim to Director FSD.",
      workItemTitle: "Review Area Office reimbursement claim",
      workItemSummary: "has a reimbursement claim awaiting Director FSD review.",
    },
    {
      from: "DIRECTOR_FSD",
      to: "HEAD_OF_DIVISION",
      assignedRole: "HEAD_OF_DIVISION",
      action: "FORWARD",
      reason: "Director FSD forwarded reimbursement claim to Head Reimbursement Division.",
      workItemTitle: "Assign reimbursement claim for HQ processing",
      workItemSummary: "has a reimbursement claim awaiting Head Reimbursement Division action.",
    },
    {
      from: "HEAD_OF_DIVISION",
      to: "HQ_REIMBURSEMENT_OFFICER",
      assignedRole: "HQ_REIMBURSEMENT_OFFICER",
      action: "FORWARD",
      reason: "Head Reimbursement Division forwarded reimbursement claim to HQ RO.",
      workItemTitle: "Process HQ reimbursement claim",
      workItemSummary: "has a reimbursement claim awaiting HQ Reimbursement Officer processing.",
    },
    {
      from: "HQ_REIMBURSEMENT_OFFICER",
      to: "HEAD_OF_DIVISION",
      assignedRole: "HEAD_OF_DIVISION",
      action: "FORWARD",
      reason: "HQ RO returned reimbursement claim to Head Reimbursement Division.",
      workItemTitle: "Verify HQ reimbursement recommendation",
      workItemSummary: "has an HQ reimbursement recommendation awaiting division verification.",
    },
    {
      from: "HEAD_OF_DIVISION",
      to: "DIRECTOR_FSD",
      assignedRole: "DIRECTOR_FSD",
      action: "FORWARD",
      reason: "Head Reimbursement Division forwarded verified claim to Director FSD.",
      workItemTitle: "Approve verified reimbursement claim",
      workItemSummary: "has a verified reimbursement claim awaiting Director FSD approval.",
    },
    {
      from: "DIRECTOR_FSD",
      to: "DIRECTOR_AUDIT",
      assignedRole: "DIRECTOR_AUDIT",
      action: "APPROVE",
      reason: "Director FSD approved the HQ reimbursement recommendation and forwarded the claim to Director Audit.",
      workItemTitle: "Receive reimbursement claim for audit",
      workItemSummary: "has an approved reimbursement claim awaiting Director Audit receipt.",
    },
    {
      from: "DIRECTOR_AUDIT",
      to: "HEAD_REIMBURSEMENT_AUDIT",
      assignedRole: "HEAD_REIMBURSEMENT_AUDIT",
      action: "FORWARD",
      reason: "Director Audit forwarded reimbursement claim to Head Reimbursement Audit.",
      workItemTitle: "Assign reimbursement audit",
      workItemSummary: "has a reimbursement claim awaiting audit assignment.",
    },
    {
      from: "HEAD_REIMBURSEMENT_AUDIT",
      to: "REIMBURSEMENT_SCHEDULE_AUDITOR",
      assignedRole: "REIMBURSEMENT_SCHEDULE_AUDITOR",
      action: "FORWARD",
      reason: "Head Reimbursement Audit forwarded claim to Reimbursement Schedule Auditor.",
      workItemTitle: "Audit reimbursement schedule",
      workItemSummary: "has a reimbursement schedule awaiting audit.",
    },
    {
      from: "REIMBURSEMENT_SCHEDULE_AUDITOR",
      to: "HEAD_REIMBURSEMENT_AUDIT",
      assignedRole: "HEAD_REIMBURSEMENT_AUDIT",
      action: "FORWARD",
      reason: "Reimbursement Schedule Auditor returned audit result to Head Reimbursement Audit.",
      workItemTitle: "Verify reimbursement audit result",
      workItemSummary: "has a reimbursement audit result awaiting verification.",
    },
    {
      from: "HEAD_REIMBURSEMENT_AUDIT",
      to: "DIRECTOR_AUDIT",
      assignedRole: "DIRECTOR_AUDIT",
      action: "FORWARD",
      reason: "Head Reimbursement Audit forwarded verified audit result to Director Audit.",
      workItemTitle: "Approve reimbursement audit clearance",
      workItemSummary: "has a verified reimbursement audit result awaiting Director Audit approval.",
    },
    {
      from: "DIRECTOR_AUDIT",
      to: "DIRECTOR_FINANCE",
      assignedRole: "DIRECTOR_FINANCE",
      action: "FORWARD",
      reason: "Director Audit forwarded audit-cleared claim to Director Finance.",
      workItemTitle: "Receive audit-cleared reimbursement claim",
      workItemSummary: "has an audit-cleared reimbursement claim awaiting finance processing.",
    },
    {
      from: "DIRECTOR_FINANCE",
      to: "HEAD_REIMBURSEMENT_FINANCE",
      assignedRole: "HEAD_REIMBURSEMENT_FINANCE",
      action: "FORWARD",
      reason: "Director Finance forwarded reimbursement claim to Head Reimbursement Finance.",
      workItemTitle: "Assign reimbursement finance processing",
      workItemSummary: "has a reimbursement claim awaiting finance assignment.",
    },
    {
      from: "HEAD_REIMBURSEMENT_FINANCE",
      to: "REIMBURSEMENT_ACCOUNTANT",
      assignedRole: "REIMBURSEMENT_ACCOUNTANT",
      action: "FORWARD",
      reason: "Head Reimbursement Finance forwarded claim to Reimbursement Accountant.",
      workItemTitle: "Prepare reimbursement payment handoff",
      workItemSummary: "has a reimbursement claim awaiting accountant payment handoff.",
    },
    {
      from: "REIMBURSEMENT_ACCOUNTANT",
      to: "HEAD_BUDGET",
      assignedRole: "HEAD_BUDGET",
      action: "FORWARD",
      reason: "Reimbursement Accountant forwarded payment file to Head Budget.",
      workItemTitle: "Review reimbursement payment for budget clearance",
      workItemSummary: "has a reimbursement payment file awaiting Head Budget review.",
    },
    {
      from: "HEAD_BUDGET",
      to: "BUDGET_OFFICER",
      assignedRole: "BUDGET_OFFICER",
      action: "FORWARD",
      reason: "Head Budget forwarded reimbursement payment file to Budget Officer.",
      workItemTitle: "Process reimbursement budget clearance",
      workItemSummary: "has a reimbursement payment file awaiting Budget Officer clearance.",
    },
    {
      from: "BUDGET_OFFICER",
      to: "HEAD_BUDGET",
      assignedRole: "HEAD_BUDGET",
      action: "FORWARD",
      reason: "Budget Officer returned reimbursement budget clearance to Head Budget.",
      workItemTitle: "Verify reimbursement budget clearance",
      workItemSummary: "has a budget clearance result awaiting Head Budget verification.",
    },
    {
      from: "HEAD_BUDGET",
      to: "DIRECTOR_AUDIT",
      assignedRole: "DIRECTOR_AUDIT",
      action: "FORWARD",
      reason: "Head Budget forwarded budget-cleared reimbursement payment file to Director Audit.",
      workItemTitle: "Receive budget-cleared reimbursement payment for audit",
      workItemSummary:
        "has a budget-cleared reimbursement payment file awaiting Director Audit receipt.",
    },
    {
      from: "DIRECTOR_AUDIT",
      to: "PRE_AUDIT_OFFICER",
      assignedRole: "PRE_AUDIT_OFFICER",
      action: "FORWARD",
      reason: "Director Audit forwarded budget-cleared reimbursement payment file to Pre-Audit Officer.",
      workItemTitle: "Pre-audit reimbursement payment file",
      workItemSummary: "has a reimbursement payment file awaiting pre-audit review.",
    },
    {
      from: "PRE_AUDIT_OFFICER",
      to: "DIRECTOR_AUDIT",
      assignedRole: "DIRECTOR_AUDIT",
      action: "FORWARD",
      reason: "Pre-Audit Officer returned reimbursement payment audit result to Director Audit.",
      workItemTitle: "Approve reimbursement payment audit clearance",
      workItemSummary: "has a pre-audit result awaiting Director Audit clearance.",
    },
  ] as const satisfies readonly ClaimRoutingTransition[];
}

export function getClaimWorkflowTransitions() {
  return [...getClaimIntakeTransitions(), ...getClaimPostIntakeTransitions()] as const;
}

export async function submitClaimToAreaManager(input: ClaimRoutingInput) {
  if (!can(input.requesterRole, "claims:submit") && !isAdminRole(input.requesterRole)) {
    throw new Error("You do not have permission to submit reimbursement claims.");
  }

  return moveClaimThroughIntake(input, getClaimIntakeTransitions()[0]);
}

export async function forwardClaimToHeadOfTraining(input: ClaimRoutingInput) {
  if (input.requesterRole !== "AREA_MANAGER" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only an Area Manager can forward this claim to HOT.");
  }

  return moveClaimThroughIntake(input, getClaimIntakeTransitions()[1]);
}

export async function forwardClaimToAreaReimbursementOfficer(input: ClaimRoutingInput) {
  if (input.requesterRole !== "HEAD_OF_TRAINING" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only HOT can forward this claim to the A/O Reimbursement Officer.");
  }

  return moveClaimThroughIntake(input, getClaimIntakeTransitions()[2]);
}

export async function forwardClaimAlongWorkflow(input: ClaimWorkflowRoutingInput) {
  const transition = getClaimWorkflowTransitions().find(
    (candidate) => candidate.from === input.fromDesk && candidate.to === input.toDesk,
  );

  if (!transition) {
    throw new Error("Unsupported reimbursement claim routing destination.");
  }

  if (!canRouteClaimFromDesk(input.requesterRole, transition.from)) {
    throw new Error(
      `Only ${transition.from.replaceAll("_", " ")} can forward this reimbursement claim.`,
    );
  }

  return moveClaimThroughIntake(input, transition);
}

async function moveClaimThroughIntake(
  input: ClaimRoutingInput,
  transition: ClaimRoutingTransition,
) {
  const db = getDb();
  const actor = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
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
      status: true,
      currentDesk: true,
      claimYear: true,
      decisions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { reason: true } },
      company: {
        select: {
          legalName: true,
          organizationId: true,
          areaOfficeId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  if (claim.currentDesk !== transition.from) {
    throw new Error(
      `This claim is currently at ${claim.currentDesk.replaceAll("_", " ")}, not ${transition.from.replaceAll("_", " ")}.`,
    );
  }

  const lastDecisionReason = claim.decisions[0]?.reason ?? "";
  if (transition.from === "HEAD_OF_DIVISION" &&
    (transition.to === "DIRECTOR_FSD") !== lastDecisionReason.includes("HQ RO returned")) {
    throw new Error("This Head of Division routing step is not available at the current review stage.");
  }
  if (transition.from === "DIRECTOR_FSD" &&
    (transition.to === "DIRECTOR_AUDIT") !== lastDecisionReason.includes("Head Reimbursement Division forwarded verified")) {
    throw new Error("This Director FSD routing step is not available at the current review stage.");
  }

  if (transition.from === "COMPANY" && claim.status !== "DRAFT") {
    throw new Error("Only draft claims can be submitted to Area Manager.");
  }

  if (transition.from !== "COMPANY" && claim.status !== "SUBMITTED") {
    throw new Error("Only submitted claims can be forwarded through Area Office intake.");
  }

  assertClaimRoutingScope({
    actorMemberships: actor.memberships,
    requesterRole: input.requesterRole,
    transition,
    organizationId: claim.company.organizationId,
    areaOfficeId: claim.company.areaOfficeId,
  });

  if (
    (transition.from === "REIMBURSEMENT_OFFICER" && transition.to === "HEAD_OF_TRAINING") ||
    (transition.from === "HEAD_OF_TRAINING" && transition.to === "AREA_MANAGER") ||
    (transition.from === "AREA_MANAGER" && transition.to === "DIRECTOR_FSD")
  ) {
    const areaCalculation = await db.reimbursementCalculationSnapshot.findFirst({
      where: { reimbursementClaimId: claim.id, stage: "AREA_OFFICE", recordTier: "HOT" },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!areaCalculation) throw new Error("The Area Office RO must save a verified Form 2A/1B calculation before this claim can advance.");
    if (transition.from !== "REIMBURSEMENT_OFFICER" && !input.note?.trim()) {
      throw new Error("HOT review and Area Manager approval each require a written decision note.");
    }
  }

  if (transition.from === "COMPANY" || transition.from === "AREA_MANAGER") {
    const eligibility = await verifyAnnualEligibility(claim.companyId, claim.claimYear ?? 0);
    if (eligibility.status !== "ELIGIBLE") {
      throw new Error(`Annual payment must be confirmed before claim processing: ${eligibility.message}`);
    }
  }

  let approvedHeadquartersAmount: number | undefined;
  if (
    (transition.from === "HQ_REIMBURSEMENT_OFFICER" && transition.to === "HEAD_OF_DIVISION") ||
    (transition.from === "HEAD_OF_DIVISION" && transition.to === "DIRECTOR_FSD") ||
    (transition.from === "DIRECTOR_FSD" && transition.to === "DIRECTOR_AUDIT")
  ) {
    const headquartersCalculation = await db.reimbursementCalculationSnapshot.findFirst({
      where: { reimbursementClaimId: claim.id, stage: "HEADQUARTERS", recordTier: "HOT" },
      select: { totalAmountAwarded: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!headquartersCalculation) throw new Error("The HQ Reimbursement Officer must save a verified Form 2A/1B calculation before this claim can advance.");
    if (transition.from !== "HQ_REIMBURSEMENT_OFFICER" && !input.note?.trim()) {
      throw new Error("Head of Reimbursement Division review and Director FSD approval each require a written decision note.");
    }
    if (transition.to === "DIRECTOR_AUDIT") approvedHeadquartersAmount = Number(headquartersCalculation.totalAmountAwarded.toString());
  }

  if (transition.from === "DIRECTOR_FSD" && transition.to === "DIRECTOR_AUDIT") {
    const eligibility = await verifyAnnualEligibility(claim.companyId, claim.claimYear ?? 0);
    if (eligibility.status !== "ELIGIBLE") throw new Error(`Claim approval is blocked: ${eligibility.message}`);
  }

  const now = new Date();
  const note = input.note?.trim();
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.reimbursementClaim.update({
      where: {
        id: claim.id,
      },
      data: {
        status: "SUBMITTED",
        currentDesk: transition.to,
        submittedAt: transition.action === "SUBMIT" ? now : undefined,
        claimRecommendedAmount: approvedHeadquartersAmount,
        claimRecommendedInWords: approvedHeadquartersAmount === undefined ? undefined : nairaInWords(approvedHeadquartersAmount),
      },
      select: {
        id: true,
      },
    });

    await tx.workItem.updateMany({
      where: {
        reimbursementClaimId: claim.id,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
      },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: getClaimWorkItemSourceKey(claim.id, transition.to),
      },
      create: {
        workspaceId: claim.company.organization.workspaceId,
        organizationId: claim.company.organizationId,
        areaOfficeId: claim.company.areaOfficeId,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        assignedRole: transition.assignedRole,
        app: "REIMBURSEMENT",
        kind: "REIMBURSEMENT_CLAIM_REVIEW",
        status: "OPEN",
        priority: "NORMAL",
        title: transition.workItemTitle,
        summary: `${claim.company.legalName} ${transition.workItemSummary}`,
        targetHref: `/claims/${claim.id}`,
        sourceKey: getClaimWorkItemSourceKey(claim.id, transition.to),
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        emailNotifiedAt: null,
        assignedRole: transition.assignedRole,
        priority: "NORMAL",
        title: transition.workItemTitle,
        summary: `${claim.company.legalName} ${transition.workItemSummary}`,
        targetHref: `/claims/${claim.id}`,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: transition.action,
        reason: [transition.reason, note].filter(Boolean).join(" "),
      },
    });

    return result;
  });

  return updated;
}

function getClaimWorkItemSourceKey(claimId: string, desk: ClaimDesk) {
  return `reimbursement-claim:${claimId}:${desk.toLowerCase()}`;
}

function assertClaimRoutingScope(input: {
  actorMemberships: {
    organizationId: string | null;
    areaOfficeId: string | null;
  }[];
  requesterRole: Role;
  transition: ClaimRoutingTransition;
  organizationId: string;
  areaOfficeId: string | null;
}) {
  if (isAdminRole(input.requesterRole)) {
    return;
  }

  if (input.transition.from === "COMPANY") {
    const canSubmitForOrganization =
      isItfRole(input.requesterRole) ||
      input.actorMemberships.some(
        (membership) => membership.organizationId === input.organizationId,
      );

    if (!canSubmitForOrganization) {
      throw new Error("You do not have access to submit this reimbursement claim.");
    }

    return;
  }

  const hasAreaOfficeAccess =
    Boolean(input.areaOfficeId) &&
    input.actorMemberships.some(
      (membership) => membership.areaOfficeId === input.areaOfficeId,
    );

  const areaOfficeScopedDesks: ClaimDesk[] = [
    "AREA_MANAGER",
    "HEAD_OF_TRAINING",
    "REIMBURSEMENT_OFFICER",
  ];

  if (areaOfficeScopedDesks.includes(input.transition.from) && !hasAreaOfficeAccess) {
    throw new Error("You do not have Area Office access for this reimbursement claim.");
  }
}

function isAdminRole(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}

const claimDeskRoles: Record<ClaimDesk, Role | null> = {
  COMPANY: null,
  AREA_MANAGER: "AREA_MANAGER",
  HEAD_OF_TRAINING: "HEAD_OF_TRAINING",
  REIMBURSEMENT_OFFICER: "REIMBURSEMENT_OFFICER",
  DIRECTOR_FSD: "DIRECTOR_FSD",
  HEAD_OF_DIVISION: "HEAD_OF_DIVISION",
  HQ_REIMBURSEMENT_OFFICER: "HQ_REIMBURSEMENT_OFFICER",
  DIRECTOR_AUDIT: "DIRECTOR_AUDIT",
  HEAD_REIMBURSEMENT_AUDIT: "HEAD_REIMBURSEMENT_AUDIT",
  REIMBURSEMENT_SCHEDULE_AUDITOR: "REIMBURSEMENT_SCHEDULE_AUDITOR",
  HEAD_BUDGET: "HEAD_BUDGET",
  BUDGET_OFFICER: "BUDGET_OFFICER",
  PRE_AUDIT_OFFICER: "PRE_AUDIT_OFFICER",
  DIRECTOR_FINANCE: "DIRECTOR_FINANCE",
  HEAD_REIMBURSEMENT_FINANCE: "HEAD_REIMBURSEMENT_FINANCE",
  REIMBURSEMENT_ACCOUNTANT: "REIMBURSEMENT_ACCOUNTANT",
};

export function canRouteClaimFromDesk(role: Role, desk: ClaimDesk) {
  if (isAdminRole(role)) {
    return true;
  }

  if (desk === "COMPANY") {
    return can(role, "claims:submit");
  }

  return claimDeskRoles[desk] === role;
}

function canManageClaimPause(role: Role) {
  return isAdminRole(role) || role === "DIRECTOR_GENERAL";
}

function canManageClaimPaymentHandoff(role: Role) {
  return (
    isAdminRole(role) ||
    role === "DIRECTOR_FINANCE" ||
    role === "HEAD_REIMBURSEMENT_FINANCE" ||
    role === "REIMBURSEMENT_ACCOUNTANT"
  );
}

function canManageClaimAuditReview(role: Role, status: ReimbursementAuditReviewStatus) {
  if (isAdminRole(role)) {
    return true;
  }

  if (role === "REIMBURSEMENT_SCHEDULE_AUDITOR") {
    return status === "DRAFT" || status === "SUBMITTED";
  }

  if (role === "HEAD_REIMBURSEMENT_AUDIT") {
    return status === "RETURNED" || status === "VERIFIED";
  }

  if (role === "DIRECTOR_AUDIT") {
    return status === "RETURNED" || status === "CLEARED";
  }

  return false;
}

function getAuditReviewDecisionAction(status: ReimbursementAuditReviewStatus) {
  if (status === "RETURNED") {
    return "REQUEST_CHANGES";
  }

  if (status === "CLEARED") {
    return "APPROVE";
  }

  if (status === "VERIFIED") {
    return "CERTIFY";
  }

  return "RECOMMEND";
}

export async function markClaimKiv(input: ClaimRoutingInput) {
  if (!canManageClaimPause(input.requesterRole)) {
    throw new Error("Only Director General can mark a reimbursement claim KIV.");
  }

  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      status: {
        in: ["SUBMITTED", "IN_REVIEW", "APPROVED"],
      },
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!claim) {
    throw new Error("An active reimbursement claim eligible for KIV was not found.");
  }

  const now = new Date();
  const note = input.note?.trim();

  return db.$transaction(async (tx) => {
    const updated = await tx.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        status: "CHANGES_REQUESTED",
      },
      select: { id: true },
    });

    await tx.workItem.updateMany({
      where: {
        reimbursementClaimId: claim.id,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: "REQUEST_CHANGES",
        reason: ["Director General marked reimbursement claim KIV/paused.", note]
          .filter(Boolean)
          .join(" "),
      },
    });

    return updated;
  });
}

export async function resumeClaimFromKiv(input: ClaimRoutingInput) {
  if (!canManageClaimPause(input.requesterRole)) {
    throw new Error("Only Director General can resume a KIV reimbursement claim.");
  }

  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      status: "CHANGES_REQUESTED",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      currentDesk: true,
      company: {
        select: {
          legalName: true,
          organizationId: true,
          areaOfficeId: true,
          organization: {
            select: {
              workspaceId: true,
            },
          },
        },
      },
    },
  });

  if (!claim) {
    throw new Error("A KIV reimbursement claim was not found.");
  }

  const assignedRole = claimDeskRoles[claim.currentDesk];
  if (!assignedRole) {
    throw new Error("This KIV claim cannot be resumed to an employer desk.");
  }

  const note = input.note?.trim();

  return db.$transaction(async (tx) => {
    const updated = await tx.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        status: "SUBMITTED",
      },
      select: { id: true },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: getClaimWorkItemSourceKey(claim.id, claim.currentDesk),
      },
      create: {
        workspaceId: claim.company.organization.workspaceId,
        organizationId: claim.company.organizationId,
        areaOfficeId: claim.company.areaOfficeId,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        assignedRole,
        app: "REIMBURSEMENT",
        kind: "REIMBURSEMENT_CLAIM_REVIEW",
        status: "OPEN",
        priority: "NORMAL",
        title: "Resume KIV reimbursement claim",
        summary: `${claim.company.legalName} has a resumed reimbursement claim awaiting ${claim.currentDesk.replaceAll("_", " ")} attention.`,
        targetHref: `/claims/${claim.id}`,
        sourceKey: getClaimWorkItemSourceKey(claim.id, claim.currentDesk),
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        emailNotifiedAt: null,
        assignedRole,
        priority: "NORMAL",
        title: "Resume KIV reimbursement claim",
        summary: `${claim.company.legalName} has a resumed reimbursement claim awaiting ${claim.currentDesk.replaceAll("_", " ")} attention.`,
        targetHref: `/claims/${claim.id}`,
      },
      select: { id: true },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: "REOPEN",
        reason: ["Director General resumed KIV reimbursement claim.", note]
          .filter(Boolean)
          .join(" "),
      },
    });

    return updated;
  });
}

export async function updateClaimPaymentHandoff(input: UpdateClaimPaymentHandoffInput) {
  if (!canManageClaimPaymentHandoff(input.requesterRole)) {
    throw new Error("You do not have permission to update reimbursement payment status.");
  }

  if (!isReimbursementPaymentHandoffStatus(input.status)) {
    throw new Error("Unsupported reimbursement payment handoff status.");
  }

  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

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
      reference: true,
      claimYear: true,
      paymentScheduleReference: true,
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  if (input.status === "PAID") {
    const eligibility = await verifyAnnualEligibility(claim.companyId, claim.claimYear ?? 0);
    if (eligibility.status !== "ELIGIBLE") throw new Error(`Payment is blocked: ${eligibility.message}`);
  }

  const now = new Date();
  const note = input.note?.trim();
  const scheduleReference =
    claim.paymentScheduleReference ?? buildReimbursementPaymentScheduleReference(claim);

  return db.$transaction(async (tx) => {
    const updated = await tx.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        paymentHandoffStatus: input.status,
        paymentScheduleReference: scheduleReference,
        paymentScheduleExportedAt:
          input.status === "EXPORTED" || input.status === "SENT_TO_PAYMENT_SYSTEM"
            ? now
            : undefined,
        paymentScheduleExportedById:
          input.status === "EXPORTED" || input.status === "SENT_TO_PAYMENT_SYSTEM"
            ? actor.id
            : undefined,
        paymentSystemReference: input.paymentSystemReference,
        paymentSystemStatus: input.paymentSystemStatus,
        paymentSystemSyncedAt:
          input.status === "SENT_TO_PAYMENT_SYSTEM" ||
          input.status === "PV_RAISED" ||
          input.status === "PV_CHECKED" ||
          input.status === "AUDIT_CLEARED" ||
          input.status === "PAID" ||
          input.status === "FAILED"
            ? now
            : undefined,
        paidAt: input.status === "PAID" ? now : undefined,
        status: input.status === "PAID" ? "SETTLED" : undefined,
        settledAt: input.status === "PAID" ? now : undefined,
      },
      select: { id: true },
    });

    if (input.status === "PAID") {
      await tx.workItem.updateMany({
        where: {
          reimbursementClaimId: claim.id,
          status: "OPEN",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
        },
      });
    }

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: input.status === "PAID" ? "SETTLE" : "RECOMMEND",
        reason: [
          `Updated reimbursement payment handoff status to ${input.status.replaceAll("_", " ")}.`,
          input.paymentSystemReference ? `Reference: ${input.paymentSystemReference}.` : undefined,
          note,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return updated;
  });
}

export async function updateClaimAuditReview(input: UpdateClaimAuditReviewInput) {
  if (!isReimbursementAuditReviewStatus(input.status)) {
    throw new Error("Unsupported reimbursement audit review status.");
  }

  if (!canManageClaimAuditReview(input.requesterRole, input.status)) {
    throw new Error("You do not have permission to update this audit review status.");
  }

  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

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
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  const now = new Date();

  return db.$transaction(async (tx) => {
    const auditReview = await tx.reimbursementAuditReview.upsert({
      where: {
        reimbursementClaimId: claim.id,
      },
      create: {
        reimbursementClaimId: claim.id,
        status: input.status,
        observations: input.observations,
        recommendation: input.recommendation,
        auditedAmount: input.auditedAmount,
        varianceAmount: input.varianceAmount,
        preparedById:
          input.requesterRole === "REIMBURSEMENT_SCHEDULE_AUDITOR" ||
          input.status === "SUBMITTED"
            ? actor.id
            : undefined,
        preparedAt:
          input.requesterRole === "REIMBURSEMENT_SCHEDULE_AUDITOR" ||
          input.status === "SUBMITTED"
            ? now
            : undefined,
        verifiedById:
          input.status === "VERIFIED" || input.status === "CLEARED" ? actor.id : undefined,
        verifiedAt:
          input.status === "VERIFIED" || input.status === "CLEARED" ? now : undefined,
      },
      update: {
        status: input.status,
        observations: input.observations,
        recommendation: input.recommendation,
        auditedAmount: input.auditedAmount,
        varianceAmount: input.varianceAmount,
        preparedById:
          input.requesterRole === "REIMBURSEMENT_SCHEDULE_AUDITOR" ||
          input.status === "SUBMITTED"
            ? actor.id
            : undefined,
        preparedAt:
          input.requesterRole === "REIMBURSEMENT_SCHEDULE_AUDITOR" ||
          input.status === "SUBMITTED"
            ? now
            : undefined,
        verifiedById:
          input.status === "VERIFIED" || input.status === "CLEARED" ? actor.id : undefined,
        verifiedAt:
          input.status === "VERIFIED" || input.status === "CLEARED" ? now : undefined,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: getAuditReviewDecisionAction(input.status),
        reason: [
          `Updated reimbursement audit review to ${input.status.replaceAll("_", " ")}.`,
          input.recommendation ? `Recommendation: ${input.recommendation}.` : undefined,
          input.observations,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return auditReview;
  });
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
          organization: { select: { workspaceId: true } },
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

  const bank = input.bankId
    ? await db.bankDirectoryEntry.findFirst({
        where: { id: input.bankId, workspaceId: claim.company.organization.workspaceId, isActive: true },
        select: { name: true, sortCode: true },
      })
    : null;
  if (input.bankId && !bank) throw new Error("Select an active bank from the accepted bank list.");

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      claimYear: input.claimYear,
      trainingContributionDue: input.trainingContributionDue,
      trainingContributionPaid: input.trainingContributionPaid,
      itfReceiptNumber: input.itfReceiptNumber,
      ...(bank ? { bankName: bank.name, sortCode: bank.sortCode } : {}),
      accountNumber: input.accountNumber,
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
  if (input.kind === "SIWES_FORM_5A" && validated.mimeType !== "application/pdf") {
    throw new Error("SIWES Form 5A must be uploaded as a PDF.");
  }
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

  if (["REIMBURSEMENT_OFFICER", "HEAD_OF_TRAINING", "AREA_MANAGER", "HQ_REIMBURSEMENT_OFFICER", "HEAD_OF_DIVISION", "DIRECTOR_FSD"].includes(input.requesterRole)) {
    throw new Error("Form 1B amounts must come from the RO's verified calculation and the approval workflow.");
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

export async function calculateAreaOfficeClaim(input: CalculateAreaOfficeClaimInput) {
  if (input.requesterRole !== "REIMBURSEMENT_OFFICER" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only the Area Office Reimbursement Officer can calculate this recommendation.");
  }
  const remarks = input.reviewerRemarks.trim();
  if (!remarks) throw new Error("The Area Office RO must record a review remark.");
  if (!input.reviewedForm1A || !input.reviewedForm2A || !input.reviewedEvidence) {
    throw new Error("Confirm review of Form 1A, Form 2A and supporting evidence before calculating.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", status: "SUBMITTED", currentDesk: "REIMBURSEMENT_OFFICER" },
    select: {
      id: true, companyId: true, employerScale: true, trainingContributionPaid: true, policyEdition: true,
      company: { select: { areaOfficeId: true } },
      lines: { where: { stage: "EMPLOYER" }, select: { stage: true, awardArea: true, totalWorkforce: true, totalTrained: true, emphasisNumber: true, percentAwarded: true } },
    },
  });
  if (!claim) throw new Error("This claim is not at the Area Office RO desk.");
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, memberships: { where: { isActive: true }, select: { areaOfficeId: true, role: true } } },
  });
  if (!actor || (!isAdminRole(input.requesterRole) && !actor.memberships.some((membership) =>
    membership.role === "REIMBURSEMENT_OFFICER" && membership.areaOfficeId && membership.areaOfficeId === claim.company.areaOfficeId
  ))) throw new Error("You do not have Area Office access to this claim.");

  const baseline = getAreaOfficeCalculationBaseline(claim);
  if (!baseline) throw new Error("The employer Form 2A/2B calculation is incomplete; the RO cannot reconstruct the baseline.");
  const calculation = applyAreaOfficeVerifiedCounts(baseline, input.verified);
  const result = calculateReimbursementAward({ ...calculation, policyEdition: claim.policyEdition });
  const lines = result.lines.map((line) => ({
    ...buildEmployerCalculationLine(line, calculation.trainingContributionPaid, calculation),
    stage: "AREA_OFFICE" as const,
  }));

  return db.$transaction(async (tx) => {
    await tx.reimbursementClaimLine.deleteMany({ where: { reimbursementClaimId: claim.id, stage: "AREA_OFFICE" } });
    await tx.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        claimRecommendedAmount: result.totalAmountAwarded,
        claimRecommendedInWords: nairaInWords(result.totalAmountAwarded),
        lines: { create: lines },
      },
      select: { id: true },
    });
    const snapshot = await tx.reimbursementCalculationSnapshot.create({
      data: {
        reimbursementClaimId: claim.id,
        stage: "AREA_OFFICE",
        policyEdition: claim.policyEdition,
        employerScale: calculation.employerScale,
        calculatedByEmail: input.requesterEmail,
        calculationInput: calculation,
        calculationResult: result,
        uncappedAwardPercent: result.uncappedTotalAwardPercent,
        cappedAwardPercent: result.cappedTotalAwardPercent,
        totalAmountAwarded: result.totalAmountAwarded,
        reviewerRemarks: remarks,
      },
      select: { id: true },
    });
    await tx.decision.create({
      data: { actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id, action: "RECOMMEND", reason: `Area Office RO reviewed Form 1A, Form 2A and evidence. Recommended NGN ${result.totalAmountAwarded.toFixed(2)}. ${remarks}` },
    });
    return snapshot;
  });
}

export async function calculateHeadquartersClaim(input: CalculateHeadquartersClaimInput) {
  if (input.requesterRole !== "HQ_REIMBURSEMENT_OFFICER" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only the HQ Reimbursement Officer can calculate this recommendation.");
  }
  const remarks = input.reviewerRemarks.trim();
  if (!remarks) throw new Error("The HQ RO must record a review remark.");
  if (!input.reviewedForm1A || !input.reviewedForm2A || !input.reviewedEvidence) {
    throw new Error("Confirm review of Form 1A, Form 2A and supporting evidence before calculating.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", status: "SUBMITTED", currentDesk: "HQ_REIMBURSEMENT_OFFICER" },
    select: {
      id: true, companyId: true, employerScale: true, trainingContributionPaid: true, policyEdition: true,
      company: { select: { organization: { select: { workspaceId: true } } } },
      lines: { where: { stage: "EMPLOYER" }, select: { stage: true, awardArea: true, totalWorkforce: true, totalTrained: true, emphasisNumber: true, percentAwarded: true } },
      calculationSnapshots: { where: { stage: "AREA_OFFICE", recordTier: "HOT" }, select: { id: true }, take: 1 },
    },
  });
  if (!claim) throw new Error("This claim is not at the HQ RO desk.");
  if (!claim.calculationSnapshots.length) throw new Error("The Area Office calculation must be saved before HQ review.");
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, isActive: true, memberships: { where: { isActive: true }, select: { areaOfficeId: true, role: true, workspaceId: true } } },
  });
  if (!actor?.isActive || (!isAdminRole(input.requesterRole) && !actor.memberships.some((membership) =>
    membership.role === "HQ_REIMBURSEMENT_OFFICER" && membership.areaOfficeId === null && membership.workspaceId === claim.company.organization.workspaceId
  ))) throw new Error("You do not have Headquarters access to this claim.");

  const baseline = getAreaOfficeCalculationBaseline(claim);
  if (!baseline) throw new Error("The employer Form 2A/2B calculation is incomplete; HQ cannot reconstruct the baseline.");
  const calculation = applyAreaOfficeVerifiedCounts(baseline, input.verified);
  const result = calculateReimbursementAward({ ...calculation, policyEdition: claim.policyEdition });
  const lines = result.lines.map((line) => ({
    ...buildEmployerCalculationLine(line, calculation.trainingContributionPaid, calculation),
    stage: "HEADQUARTERS" as const,
  }));

  return db.$transaction(async (tx) => {
    await tx.reimbursementClaimLine.deleteMany({ where: { reimbursementClaimId: claim.id, stage: "HEADQUARTERS" } });
    await tx.reimbursementClaim.update({ where: { id: claim.id }, data: { lines: { create: lines } }, select: { id: true } });
    const snapshot = await tx.reimbursementCalculationSnapshot.create({
      data: {
        reimbursementClaimId: claim.id, stage: "HEADQUARTERS", policyEdition: claim.policyEdition,
        employerScale: calculation.employerScale, calculatedByEmail: input.requesterEmail,
        calculationInput: calculation, calculationResult: result,
        uncappedAwardPercent: result.uncappedTotalAwardPercent,
        cappedAwardPercent: result.cappedTotalAwardPercent,
        totalAmountAwarded: result.totalAmountAwarded, reviewerRemarks: remarks,
      },
      select: { id: true },
    });
    await tx.decision.create({
      data: { actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id, action: "RECOMMEND", reason: `HQ RO independently reviewed Form 1A, Form 2A and evidence. Recommended NGN ${result.totalAmountAwarded.toFixed(2)}. ${remarks}` },
    });
    return snapshot;
  });
}

function getContributionVerificationDecisionAction(
  status: ContributionVerificationStatus,
) {
  if (status === "VERIFIED") {
    return "APPROVE";
  }

  if (status === "REJECTED") {
    return "REJECT";
  }

  if (status === "NEEDS_REVIEW") {
    return "REQUEST_CHANGES";
  }

  return "REOPEN";
}

export async function updateClaimContributionVerification(
  input: UpdateClaimContributionVerificationInput,
) {
  if (
    input.requesterRole !== "SYSTEM_ADMIN" &&
    input.requesterRole !== "WORKSPACE_APP_ADMIN" &&
    !can(input.requesterRole, "claims:review") &&
    !can(input.requesterRole, "claims:approve")
  ) {
    throw new Error("You do not have permission to verify claim contribution eligibility.");
  }

  if (!isContributionVerificationStatus(input.status)) {
    throw new Error("Unsupported contribution verification status.");
  }

  if (!isContributionVerificationSource(input.source)) {
    throw new Error("Unsupported contribution verification source.");
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
      companyId: true,
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

  const hasAreaOfficeAccess =
    input.requesterRole === "SYSTEM_ADMIN" ||
    input.requesterRole === "WORKSPACE_APP_ADMIN" ||
    input.requesterRole === "ITF_CLAIMS_REVIEWER" ||
    input.requesterRole === "ITF_CLAIMS_APPROVER" ||
    input.requesterRole === "HEAD_OF_DIVISION" ||
    input.requesterRole === "DIRECTOR_FSD" ||
    input.requesterRole === "HQ_REIMBURSEMENT_OFFICER" ||
    actor.memberships.some((membership) => membership.areaOfficeId === claim.company.areaOfficeId);

  if (!hasAreaOfficeAccess) {
    throw new Error("You do not have access to verify this Area Office claim.");
  }

  const checkedAt = new Date();
  const statusLabel = formatContributionVerificationStatus(input.status);
  const sourceLabel = formatContributionVerificationSource(input.source);

  return db.$transaction(async (tx) => {
    const updated = await tx.reimbursementClaim.update({
      where: {
        id: claim.id,
      },
      data: {
        contributionVerificationStatus: input.status,
        contributionVerificationSource: input.source,
        contributionVerificationNote: input.note,
        contributionVerifiedById: actor.id,
        contributionVerifiedAt: checkedAt,
        externalVerificationProvider: input.externalVerificationProvider,
        externalVerificationReference: input.externalVerificationReference,
        externalVerificationCheckedAt:
          input.source === "EXTERNAL_SYSTEM" ? checkedAt : undefined,
        externalVerificationMessage: input.externalVerificationMessage,
      },
      select: {
        id: true,
      },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: getContributionVerificationDecisionAction(input.status),
        reason: [
          `Contribution eligibility marked ${statusLabel}.`,
          `Source: ${sourceLabel}.`,
          input.externalVerificationReference
            ? `Reference: ${input.externalVerificationReference}.`
            : undefined,
          input.note,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return updated;
  });
}

export async function updateEmployerClaimCalculation(input: UpdateEmployerClaimCalculationInput) {
  if (!can(input.requesterRole, "claims:submit") || isItfRole(input.requesterRole)) {
    throw new Error("Only employers can update reimbursement claim calculations.");
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
      policyEdition: true,
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

  const hasOrganizationAccess = requester.memberships.some(
    (membership) => membership.organizationId === claim.company.organizationId,
  );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to update this claim calculation.");
  }

  const result = calculateReimbursementAward({
    ...input.calculation,
    policyEdition: claim.policyEdition,
  });
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

    await tx.reimbursementCalculationSnapshot.create({
      data: {
        reimbursementClaimId: claim.id,
        stage: "EMPLOYER",
        policyEdition: claim.policyEdition,
        employerScale: input.calculation.employerScale,
        calculatedByEmail: input.requesterEmail,
        calculationInput: input.calculation,
        calculationResult: result,
        uncappedAwardPercent: result.uncappedTotalAwardPercent,
        cappedAwardPercent: result.cappedTotalAwardPercent,
        totalAmountAwarded: result.totalAmountAwarded,
      },
    });

    return {
      id: claim.id,
    };
  });
}

export async function updateClaimStaffEntries(input: UpdateClaimStaffEntriesInput) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to update claim staff entries.");
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
    throw new Error("You do not have access to update claim staff entries.");
  }

  const preparedEntries = prepareClaimStaffEntries(input.entries);

  return db.$transaction(async (tx) => {
    await tx.reimbursementClaimStaffEntry.deleteMany({
      where: {
        reimbursementClaimId: claim.id,
      },
    });

    if (preparedEntries.length > 0) {
      await tx.reimbursementClaimStaffEntry.createMany({
        data: preparedEntries.map((entry) => ({
          reimbursementClaimId: claim.id,
          employeeId: entry.employeeId.trim(),
          normalizedEmployeeId: entry.normalizedEmployeeId,
          employeeName: entry.employeeName?.trim() || null,
          trainingArea: entry.trainingArea,
          duplicateGroupKey: entry.duplicateGroupKey ?? null,
          duplicateDetectedAt: entry.duplicateDetectedAt,
        })),
      });
    }

    return {
      id: claim.id,
      count: preparedEntries.length,
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

  const existingLine = await getDb().reimbursementClaimLine.findFirst({
    where: { id: input.lineId, reimbursementClaimId: claim.id },
    select: { awardArea: true },
  });
  if (!existingLine) throw new Error("Claim calculation row was not found.");
  if (existingLine.awardArea) throw new Error("Calculated rows are read-only. Update the schedule and calculate again.");

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

  const existingLine = await getDb().reimbursementClaimLine.findFirst({
    where: { id: input.lineId, reimbursementClaimId: claim.id },
    select: { awardArea: true },
  });
  if (!existingLine) throw new Error("Claim calculation row was not found.");
  if (existingLine.awardArea) throw new Error("Calculated rows cannot be deleted individually. Update the schedule and calculate again.");

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
  if (!can(input.requesterRole, "claims:submit") || isItfRole(input.requesterRole)) {
    throw new Error("Only employers can edit claim calculations.");
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
        },
      },
    },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const hasAccess = actor.memberships.some(
    (membership) => membership.organizationId === claim.company.organizationId,
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
