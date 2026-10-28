import { getDb } from "@/lib/db";
import { buildHqComputationTableSummary, isCurrentHqComputationTable } from "@/lib/hq-computation-table";
import { requiredVoucherSignoffForHandoff } from "@/lib/reimbursement-voucher-signoffs";
import { isIndividuallyAssignedClaimRole, listAssignableClaimOfficers, resolveClaimOfficerAssignment } from "@/lib/claim-officer-assignment";
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
  validateReimbursementPaymentSchedule,
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
export type SaveHqComputationTableInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  rows: { lineId: string; expenditureClaimed: number; remarks: string }[];
};

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
  assigneeUserId?: string;
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
  paymentAccountType?: string;
  paymentWithholdingTax?: number;
  paymentTaxOffset?: number;
};

export type UpdateClaimAuditReviewInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  status: ReimbursementAuditReviewStatus;
  observations?: string;
  recommendation?: string;
  note?: string;
};

export type UpdatePaymentFileAuditInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED";
  voucherChecked?: boolean;
  budgetChecked?: boolean;
  bankDetailsChecked?: boolean;
  amountChecked?: boolean;
  observations?: string;
  note?: string;
};

export type CalculateAuditorClaimInput = CalculateAreaOfficeClaimInput;

export type ClaimDesk =
  | "COMPANY"
  | "AREA_MANAGER"
  | "HEAD_OF_TRAINING"
  | "REIMBURSEMENT_OFFICER"
  | "DIRECTOR_FSD"
  | "HEAD_OF_DIVISION"
  | "HQ_REIMBURSEMENT_OFFICER"
  | "DIRECTOR_AUDIT"
  | "DIRECTOR_GENERAL"
  | "HEAD_REIMBURSEMENT_AUDIT"
  | "REIMBURSEMENT_SCHEDULE_AUDITOR"
  | "HEAD_BUDGET"
  | "BUDGET_OFFICER"
  | "PRE_AUDIT_OFFICER"
  | "HEAD_PRE_AUDIT"
  | "DIRECTOR_FINANCE"
  | "HEAD_ACCOUNTS"
  | "HEAD_REIMBURSEMENT_FINANCE"
  | "REIMBURSEMENT_ACCOUNTANT"
  | "HEAD_EXPENDITURE"
  | "EXPENDITURE_ACCOUNTANT"
  | "PAYMENT_INITIATOR";

export function formatClaimDesk(desk: ClaimDesk) {
  const labels: Partial<Record<ClaimDesk, string>> = {
    DIRECTOR_FSD: "Director, Field Services Department",
    HEAD_OF_DIVISION: "Head of Reimbursement Division",
    HQ_REIMBURSEMENT_OFFICER: "HQ Reimbursement Officer",
    HEAD_REIMBURSEMENT_AUDIT: "Head Reimbursement Audit",
    REIMBURSEMENT_SCHEDULE_AUDITOR: "Reimbursement Schedule Auditor",
    HEAD_BUDGET: "Head Budget",
    BUDGET_OFFICER: "Budget Officer",
    PRE_AUDIT_OFFICER: "Pre-Audit Officer",
    DIRECTOR_FINANCE: "Director, Finance and Accounts Department",
    HEAD_ACCOUNTS: "Head of Accounts",
    HEAD_REIMBURSEMENT_FINANCE: "Head of Reimbursement Account",
    REIMBURSEMENT_ACCOUNTANT: "Reimbursement Schedule Accountant",
    HEAD_PRE_AUDIT: "Head Pre-Audit",
    HEAD_EXPENDITURE: "Head Expenditure",
    EXPENDITURE_ACCOUNTANT: "Expenditure Accountant",
    PAYMENT_INITIATOR: "Payment Initiator",
  };
  return labels[desk] ?? desk.replaceAll("_", " ");
}

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
      to: "DIRECTOR_GENERAL",
      assignedRole: "DIRECTOR_GENERAL",
      action: "FORWARD",
      reason: "Director Audit forwarded audit-cleared claim to Director General.",
      workItemTitle: "Decide audited reimbursement claim",
      workItemSummary: "has an audited reimbursement claim awaiting Director General decision.",
    },
    {
      from: "DIRECTOR_GENERAL",
      to: "DIRECTOR_FINANCE",
      assignedRole: "DIRECTOR_FINANCE",
      action: "APPROVE",
      reason: "Director General approved the claim for payment and forwarded it to DFAD.",
      workItemTitle: "Receive DG-approved reimbursement claim",
      workItemSummary: "has a DG-approved reimbursement claim awaiting finance processing.",
    },
    {
      from: "DIRECTOR_FINANCE",
      to: "HEAD_ACCOUNTS",
      assignedRole: "HEAD_ACCOUNTS",
      action: "FORWARD",
      reason: "DFAD forwarded reimbursement claim to Head of Accounts.",
      workItemTitle: "Route reimbursement claim to Accounts",
      workItemSummary: "has a reimbursement claim awaiting Accounts routing.",
    },
    {
      from: "HEAD_ACCOUNTS",
      to: "HEAD_REIMBURSEMENT_FINANCE",
      assignedRole: "HEAD_REIMBURSEMENT_FINANCE",
      action: "FORWARD",
      reason: "Head of Accounts forwarded claim to Head of Reimbursement Account.",
      workItemTitle: "Assign reimbursement payment voucher",
      workItemSummary: "has a reimbursement claim awaiting payment voucher preparation.",
    },
    {
      from: "HEAD_REIMBURSEMENT_FINANCE",
      to: "REIMBURSEMENT_ACCOUNTANT",
      assignedRole: "REIMBURSEMENT_ACCOUNTANT",
      action: "FORWARD",
      reason: "Head of Reimbursement Account forwarded claim to Reimbursement Schedule Accountant.",
      workItemTitle: "Process reimbursement payment packet",
      workItemSummary: "has a reimbursement claim awaiting Schedule Accountant action.",
    },
    {
      from: "REIMBURSEMENT_ACCOUNTANT",
      to: "HEAD_REIMBURSEMENT_FINANCE",
      assignedRole: "HEAD_REIMBURSEMENT_FINANCE",
      action: "FORWARD",
      reason: "Reimbursement Schedule Accountant returned payment voucher to Head of Reimbursement Account.",
      workItemTitle: "Forward payment voucher for budget clearance",
      workItemSummary: "has a payment voucher awaiting onward routing to Budget.",
    },
    {
      from: "HEAD_REIMBURSEMENT_FINANCE",
      to: "HEAD_BUDGET",
      assignedRole: "HEAD_BUDGET",
      action: "FORWARD",
      reason: "Head of Reimbursement Account forwarded payment voucher to Head Budget.",
      workItemTitle: "Review reimbursement payment voucher",
      workItemSummary: "has a payment voucher awaiting budget clearance.",
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
      to: "HEAD_PRE_AUDIT",
      assignedRole: "HEAD_PRE_AUDIT",
      action: "FORWARD",
      reason: "Director Audit forwarded budget-cleared payment file to Head Pre-Audit.",
      workItemTitle: "Assign payment-file pre-audit",
      workItemSummary: "has a budget-cleared payment file awaiting pre-audit assignment.",
    },
    {
      from: "HEAD_PRE_AUDIT",
      to: "PRE_AUDIT_OFFICER",
      assignedRole: "PRE_AUDIT_OFFICER",
      action: "FORWARD",
      reason: "Head Pre-Audit assigned payment-file pre-audit to Pre-Audit Officer.",
      workItemTitle: "Pre-audit reimbursement payment file",
      workItemSummary: "has a reimbursement payment file awaiting pre-audit review.",
    },
    {
      from: "PRE_AUDIT_OFFICER",
      to: "HEAD_PRE_AUDIT",
      assignedRole: "HEAD_PRE_AUDIT",
      action: "FORWARD",
      reason: "Pre-Audit Officer returned reimbursement payment audit result to Head Pre-Audit.",
      workItemTitle: "Verify reimbursement payment-file pre-audit",
      workItemSummary: "has a pre-audit result awaiting Head Pre-Audit verification.",
    },
    {
      from: "HEAD_PRE_AUDIT",
      to: "HEAD_REIMBURSEMENT_FINANCE",
      assignedRole: "HEAD_REIMBURSEMENT_FINANCE",
      action: "FORWARD",
      reason: "Head Pre-Audit returned cleared payment file to Head of Reimbursement Account.",
      workItemTitle: "Assign e-payment schedule preparation",
      workItemSummary: "has a pre-audited payment file awaiting e-payment schedule preparation.",
    },
    {
      from: "REIMBURSEMENT_ACCOUNTANT",
      to: "HEAD_ACCOUNTS",
      assignedRole: "HEAD_ACCOUNTS",
      action: "FORWARD",
      reason: "Reimbursement Schedule Accountant forwarded e-payment schedule to Head of Accounts.",
      workItemTitle: "Route e-payment schedule to Expenditure",
      workItemSummary: "has an e-payment schedule awaiting Accounts review.",
    },
    {
      from: "HEAD_ACCOUNTS",
      to: "HEAD_EXPENDITURE",
      assignedRole: "HEAD_EXPENDITURE",
      action: "FORWARD",
      reason: "Head of Accounts forwarded e-payment schedule to Head Expenditure.",
      workItemTitle: "Assign e-payment execution",
      workItemSummary: "has an e-payment schedule awaiting expenditure routing.",
    },
    {
      from: "HEAD_EXPENDITURE",
      to: "EXPENDITURE_ACCOUNTANT",
      assignedRole: "EXPENDITURE_ACCOUNTANT",
      action: "FORWARD",
      reason: "Head Expenditure forwarded e-payment schedule to Expenditure Accountant.",
      workItemTitle: "Review e-payment schedule",
      workItemSummary: "has an e-payment schedule awaiting expenditure review.",
    },
    {
      from: "EXPENDITURE_ACCOUNTANT",
      to: "PAYMENT_INITIATOR",
      assignedRole: "PAYMENT_INITIATOR",
      action: "FORWARD",
      reason: "Expenditure Accountant forwarded payment packet to Initiator.",
      workItemTitle: "Execute reimbursement payment",
      workItemSummary: "has an approved payment packet awaiting payment execution and evidence.",
    },
    {
      from: "PAYMENT_INITIATOR",
      to: "HEAD_EXPENDITURE",
      assignedRole: "HEAD_EXPENDITURE",
      action: "FORWARD",
      reason: "Initiator returned payment packet and evidence to Head Expenditure.",
      workItemTitle: "Forward payment evidence",
      workItemSummary: "has payment evidence awaiting onward routing.",
    },
    {
      from: "HEAD_EXPENDITURE",
      to: "HEAD_REIMBURSEMENT_FINANCE",
      assignedRole: "HEAD_REIMBURSEMENT_FINANCE",
      action: "FORWARD",
      reason: "Head Expenditure returned paid packet to Head of Reimbursement Account.",
      workItemTitle: "Return paid packet to Schedule Accountant",
      workItemSummary: "has a paid packet awaiting final status recording.",
    },
  ] as const satisfies readonly ClaimRoutingTransition[];
}

export function getClaimWorkflowTransitions() {
  return [...getClaimIntakeTransitions(), ...getClaimPostIntakeTransitions()] as const;
}

export function getLatestClaimRoutingReason(decisions: readonly { reason: string | null }[]) {
  const reasons = getClaimWorkflowTransitions().map((transition) => transition.reason);
  return decisions.find((decision) => reasons.some((reason) => decision.reason?.startsWith(reason)))?.reason ?? "";
}

const claimCorrectionReturns = [
  { from: "HEAD_OF_DIVISION", to: "HQ_REIMBURSEMENT_OFFICER", arrived: "HQ RO returned reimbursement claim" },
  { from: "HEAD_REIMBURSEMENT_AUDIT", to: "REIMBURSEMENT_SCHEDULE_AUDITOR", arrived: "Reimbursement Schedule Auditor returned audit result" },
  { from: "HEAD_BUDGET", to: "BUDGET_OFFICER", arrived: "Budget Officer returned reimbursement budget clearance" },
  { from: "HEAD_PRE_AUDIT", to: "PRE_AUDIT_OFFICER", arrived: "Pre-Audit Officer returned reimbursement payment audit result" },
] as const satisfies readonly { from: ClaimDesk; to: ClaimDesk; arrived: string }[];

export function getClaimCorrectionReturnTarget(desk: ClaimDesk, latestRoutingReason: string): Exclude<ClaimDesk, "COMPANY"> | null {
  return claimCorrectionReturns.find((item) => item.from === desk && latestRoutingReason.startsWith(item.arrived))?.to ?? null;
}

export async function returnClaimForCorrection(input: ClaimRoutingInput) {
  const note = input.note?.trim();
  if (!note) throw new Error("Explain what the officer must correct before returning the claim.");
  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, status: "SUBMITTED", recordTier: "HOT", company: { isActive: true, recordTier: "HOT" } },
    select: {
      id: true, companyId: true, currentDesk: true,
      company: { select: { legalName: true, organizationId: true, areaOfficeId: true, organization: { select: { workspaceId: true } } } },
      decisions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 60, select: { reason: true, actorId: true } },
    },
  });
  if (!claim || !canRouteClaimFromDesk(input.requesterRole, claim.currentDesk)) throw new Error("This claim is not at your review desk.");
  const latestReason = getLatestClaimRoutingReason(claim.decisions);
  const target = getClaimCorrectionReturnTarget(claim.currentDesk, latestReason);
  if (!target) throw new Error("A correction return is not available at this review stage.");
  const forwardingReason = getClaimPostIntakeTransitions().find((item) => item.from === target && item.to === claim.currentDesk)?.reason;
  const senderDecision = claim.decisions.find((decision) => decision.reason?.startsWith(forwardingReason ?? "\0"));
  if (!senderDecision) throw new Error("The sending officer could not be identified.");
  const actor = await db.user.findFirst({
    where: { email: input.requesterEmail, isActive: true, memberships: { some: { isActive: true, role: input.requesterRole, workspaceId: claim.company.organization.workspaceId } } },
    select: { id: true },
  });
  if (!actor) throw new Error("You do not have access to return this claim.");
  const sender = await db.user.findFirst({
    where: { id: senderDecision.actorId, isActive: true, memberships: { some: { isActive: true, role: target, workspaceId: claim.company.organization.workspaceId } } },
    select: { id: true, name: true },
  });
  if (!sender) throw new Error("The sending officer is no longer active in this role. Ask an administrator to resolve the assignment.");
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.reimbursementClaim.update({
      where: { id: claim.id, currentDesk: claim.currentDesk, status: "SUBMITTED" },
      data: { currentDesk: target }, select: { id: true },
    });
    await tx.workItem.updateMany({ where: { reimbursementClaimId: claim.id, status: "OPEN", app: "REIMBURSEMENT" }, data: { status: "RESOLVED", resolvedAt: now } });
    await tx.workItem.upsert({
      where: { sourceKey: getClaimWorkItemSourceKey(claim.id, target) },
      create: {
        sourceKey: getClaimWorkItemSourceKey(claim.id, target), workspaceId: claim.company.organization.workspaceId,
        organizationId: claim.company.organizationId, areaOfficeId: claim.company.areaOfficeId,
        companyId: claim.companyId, reimbursementClaimId: claim.id, app: "REIMBURSEMENT", recordTier: "HOT",
        kind: "REIMBURSEMENT_CLAIM_REVIEW", assignedRole: target, assignedUserId: sender.id,
        status: "OPEN", priority: "NORMAL", title: "Correct returned reimbursement claim",
        summary: `${claim.company.legalName} has a claim returned for correction: ${note}`,
        targetHref: `/claims/${claim.id}`,
      },
      update: {
        status: "OPEN", resolvedAt: null, emailNotifiedAt: null, assignedRole: target, assignedUserId: sender.id,
        priority: "NORMAL", title: "Correct returned reimbursement claim",
        summary: `${claim.company.legalName} has a claim returned for correction: ${note}`,
        targetHref: `/claims/${claim.id}`,
      },
      select: { id: true },
    });
    if (target === "REIMBURSEMENT_SCHEDULE_AUDITOR") {
      await tx.reimbursementAuditReview.updateMany({ where: { reimbursementClaimId: claim.id }, data: {
        status: "DRAFT", auditedAmount: null, varianceAmount: null, preparedById: null, preparedAt: null,
        verifiedById: null, verifiedAt: null,
      } });
    }
    if (target === "PRE_AUDIT_OFFICER") {
      await tx.reimbursementPaymentFileAudit.updateMany({ where: { reimbursementClaimId: claim.id }, data: {
        status: "DRAFT", voucherChecked: false, budgetChecked: false, bankDetailsChecked: false, amountChecked: false,
        preparedById: null, preparedAt: null, verifiedById: null, verifiedAt: null,
      } });
      await tx.reimbursementVoucherSignoff.deleteMany({ where: { reimbursementClaimId: claim.id, kind: { in: ["PRE_AUDIT_CLEARED", "PRE_AUDIT_VERIFIED"] } } });
    }
    if (target === "BUDGET_OFFICER") {
      await tx.reimbursementVoucherSignoff.deleteMany({ where: { reimbursementClaimId: claim.id, kind: { in: ["BUDGET_CLEARED", "BUDGET_VERIFIED"] } } });
    }
    await tx.decision.create({
      data: { actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id,
        action: "REQUEST_CHANGES", reason: `${formatClaimDesk(claim.currentDesk)} returned the claim to ${sender.name} (${formatClaimDesk(target)}) for correction. Previous clearance at that desk, if any, was voided. Reason: ${note}` },
    });
  });
}

export function requiredAuditForClaimHandoff(from: ClaimDesk, to: ClaimDesk) {
  if (from === "REIMBURSEMENT_SCHEDULE_AUDITOR" && to === "HEAD_REIMBURSEMENT_AUDIT") return { kind: "CLAIM", status: "SUBMITTED" } as const;
  if (from === "HEAD_REIMBURSEMENT_AUDIT" && to === "DIRECTOR_AUDIT") return { kind: "CLAIM", status: "VERIFIED" } as const;
  if (from === "DIRECTOR_AUDIT" && to === "DIRECTOR_GENERAL") return { kind: "CLAIM", status: "CLEARED" } as const;
  if (from === "PRE_AUDIT_OFFICER" && to === "HEAD_PRE_AUDIT") return { kind: "PAYMENT_FILE", status: "SUBMITTED" } as const;
  if (from === "HEAD_PRE_AUDIT" && to === "HEAD_REIMBURSEMENT_FINANCE") return { kind: "PAYMENT_FILE", status: "VERIFIED" } as const;
  return null;
}

export function isClaimPostIntakeTransitionAvailable(input: {
  from: ClaimDesk;
  to: ClaimDesk;
  lastRoutingReason: string;
  paymentVoucherRaised: boolean;
  preAuditReturned: boolean;
  paymentReturned: boolean;
  scheduleCreated: boolean;
}) {
  const { from, to, lastRoutingReason: reason, paymentVoucherRaised, preAuditReturned, paymentReturned, scheduleCreated } = input;
  const arrivedFrom = (prefix: string) => reason.startsWith(prefix);
  if (from === "HEAD_OF_TRAINING" && to === "AREA_MANAGER") return arrivedFrom("A/O Reimbursement Officer forwarded");
  if (from === "AREA_MANAGER" && to === "DIRECTOR_FSD") return arrivedFrom("HOT reviewed the Area Office");
  if (from === "HEAD_OF_DIVISION") return to === (arrivedFrom("HQ RO returned") ? "DIRECTOR_FSD" : "HQ_REIMBURSEMENT_OFFICER");
  if (from === "DIRECTOR_FSD") return to === (arrivedFrom("Head Reimbursement Division forwarded verified") ? "DIRECTOR_AUDIT" : "HEAD_OF_DIVISION");
  if (from === "HEAD_REIMBURSEMENT_AUDIT") return to === (arrivedFrom("Reimbursement Schedule Auditor returned") ? "DIRECTOR_AUDIT" : "REIMBURSEMENT_SCHEDULE_AUDITOR");
  if (from === "DIRECTOR_AUDIT") {
    if (arrivedFrom("Head Budget forwarded budget-cleared")) return to === "HEAD_PRE_AUDIT";
    return to === (arrivedFrom("Head Reimbursement Audit forwarded verified") ? "DIRECTOR_GENERAL" : "HEAD_REIMBURSEMENT_AUDIT");
  }
  if (from === "HEAD_ACCOUNTS") return to === (arrivedFrom("Reimbursement Schedule Accountant forwarded e-payment") ? "HEAD_EXPENDITURE" : "HEAD_REIMBURSEMENT_FINANCE");
  if (from === "HEAD_REIMBURSEMENT_FINANCE") {
    return to === (arrivedFrom("Reimbursement Schedule Accountant returned payment voucher") ? "HEAD_BUDGET" : "REIMBURSEMENT_ACCOUNTANT");
  }
  if (from === "REIMBURSEMENT_ACCOUNTANT") {
    if (paymentReturned) return false;
    if (!preAuditReturned) return paymentVoucherRaised && to === "HEAD_REIMBURSEMENT_FINANCE";
    return scheduleCreated && to === "HEAD_ACCOUNTS";
  }
  if (from === "HEAD_BUDGET") return to === (arrivedFrom("Budget Officer returned") ? "DIRECTOR_AUDIT" : "BUDGET_OFFICER");
  if (from === "HEAD_PRE_AUDIT") return to === (arrivedFrom("Pre-Audit Officer returned") ? "HEAD_REIMBURSEMENT_FINANCE" : "PRE_AUDIT_OFFICER");
  if (from === "HEAD_EXPENDITURE") return to === (arrivedFrom("Initiator returned payment packet") ? "HEAD_REIMBURSEMENT_FINANCE" : "EXPENDITURE_ACCOUNTANT");
  return true;
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
      name: true,
      memberships: {
        where: { isActive: true },
        select: {
          organizationId: true,
          areaOfficeId: true,
          role: true,
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
      paymentHandoffStatus: true,
      voucherSignoffRequired: true,
      computationRequired: true,
      claimRecommendedAmount: true,
      voucherSignoffs: { select: { kind: true } },
      paymentScheduleExportedAt: true,
      decisions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 60, select: { reason: true, createdAt: true } },
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

  const lastRoutingReason = getLatestClaimRoutingReason(claim.decisions);
  const preAuditReturned = claim.decisions.some((decision) => decision.reason?.startsWith("Pre-Audit Officer returned reimbursement payment audit result"));
  const paymentReturned = claim.decisions.some((decision) => decision.reason?.startsWith("Initiator returned payment packet"));
  const paymentVoucherRaised = claim.paymentHandoffStatus === "PV_RAISED" ||
    claim.decisions.some((decision) => decision.reason?.startsWith("Updated reimbursement payment handoff status to PV RAISED"));
  if (!isClaimPostIntakeTransitionAvailable({
      from: transition.from,
      to: transition.to,
      lastRoutingReason,
      paymentVoucherRaised,
      preAuditReturned,
      paymentReturned,
      scheduleCreated: Boolean(claim.paymentScheduleExportedAt),
    })) {
    throw new Error("This claim routing step is not available at the current review stage.");
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

  let assignedUserId: string | null = null;
  if (isIndividuallyAssignedClaimRole(transition.assignedRole)) {
    const officers = await listAssignableClaimOfficers({
      role: transition.assignedRole,
      workspaceId: claim.company.organization.workspaceId,
      areaOfficeId: claim.company.areaOfficeId,
    });
    assignedUserId = resolveClaimOfficerAssignment(officers, input.assigneeUserId);
  } else if (input.assigneeUserId) {
    throw new Error("An individual officer cannot be selected for this shared desk.");
  }

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
  let computationToConfirmId: string | undefined;
  if (
    (transition.from === "HQ_REIMBURSEMENT_OFFICER" && transition.to === "HEAD_OF_DIVISION") ||
    (transition.from === "HEAD_OF_DIVISION" && transition.to === "DIRECTOR_FSD") ||
    (transition.from === "DIRECTOR_FSD" && transition.to === "DIRECTOR_AUDIT")
  ) {
    const headquartersCalculation = await db.reimbursementCalculationSnapshot.findFirst({
      where: { reimbursementClaimId: claim.id, stage: "HEADQUARTERS", recordTier: "HOT" },
      select: { totalAmountAwarded: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!headquartersCalculation) throw new Error("The HQ Reimbursement Officer must save a verified Form 2A/1B calculation before this claim can advance.");
    const table = claim.computationRequired ? await db.reimbursementComputationTable.findFirst({
      where: { reimbursementClaimId: claim.id, recordTier: "HOT" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true, createdAt: true, amountRecommended: true },
    }) : null;
    const lastHqCorrectionAt = claim.decisions.find((decision) => decision.reason?.startsWith("Head of Reimbursement Division returned the claim to"))?.createdAt;
    if (claim.computationRequired && !isCurrentHqComputationTable({ tableCreatedAt: table?.createdAt ?? null, calculationCreatedAt: headquartersCalculation.createdAt, lastCorrectionAt: lastHqCorrectionAt })) {
      throw new Error("The HQ RO must prepare a computation table from the latest Form 1B calculation before this claim advances.");
    }
    if (transition.from === "HQ_REIMBURSEMENT_OFFICER" && transition.to === "HEAD_OF_DIVISION" && claim.computationRequired && table?.status !== "PREPARED") {
      throw new Error("Prepare the HQ computation table before returning this claim to Head of Division.");
    }
    if (transition.from === "HEAD_OF_DIVISION" && transition.to === "DIRECTOR_FSD" && table) {
      if (table.status !== "PREPARED") throw new Error("Head of Division can confirm only a prepared HQ computation table.");
      computationToConfirmId = table.id;
    }
    if (transition.from === "DIRECTOR_FSD" && transition.to === "DIRECTOR_AUDIT" && table?.status !== "CONFIRMED" && claim.computationRequired) {
      throw new Error("Head of Division must confirm the HQ computation table before DFSD approval.");
    }
    if (transition.from !== "HQ_REIMBURSEMENT_OFFICER" && !input.note?.trim()) {
      throw new Error("Head of Reimbursement Division review and Director FSD approval each require a written decision note.");
    }
    if (transition.to === "DIRECTOR_AUDIT") approvedHeadquartersAmount = Number((table?.amountRecommended ?? headquartersCalculation.totalAmountAwarded).toString());
  }

  if (transition.from === "DIRECTOR_FSD" && transition.to === "DIRECTOR_AUDIT") {
    const eligibility = await verifyAnnualEligibility(claim.companyId, claim.claimYear ?? 0);
    if (eligibility.status !== "ELIGIBLE") throw new Error(`Claim approval is blocked: ${eligibility.message}`);
  }

  const requiredAudit = requiredAuditForClaimHandoff(transition.from, transition.to);
  if (requiredAudit?.kind === "CLAIM") {
    const review = await db.reimbursementAuditReview.findUnique({
      where: { reimbursementClaimId: claim.id }, select: { status: true },
    });
    if (review?.status !== requiredAudit.status) throw new Error(`Claim audit must be ${requiredAudit.status.toLowerCase()} before this handoff.`);
  }

  if (requiredAudit?.kind === "PAYMENT_FILE") {
    const review = await db.reimbursementPaymentFileAudit.findUnique({
      where: { reimbursementClaimId: claim.id }, select: { status: true },
    });
    if (review?.status !== requiredAudit.status) throw new Error(`Payment-file pre-audit must be ${requiredAudit.status.toLowerCase()} before this handoff.`);
  }

  if (transition.from === "HEAD_REIMBURSEMENT_FINANCE" && transition.to === "HEAD_BUDGET" && !paymentVoucherRaised) {
    throw new Error("The Reimbursement Schedule Accountant must raise the payment voucher before budget review.");
  }
  const requiredSignoff = requiredVoucherSignoffForHandoff(transition.from, transition.to);
  if (claim.voucherSignoffRequired && requiredSignoff && !claim.voucherSignoffs.some((signoff) => signoff.kind === requiredSignoff)) {
    throw new Error(`Record the ${requiredSignoff.replaceAll("_", " ").toLowerCase()} before forwarding this packet.`);
  }
  if ((transition.from === "PAYMENT_INITIATOR" && transition.to === "HEAD_EXPENDITURE") ||
    (transition.from === "HEAD_EXPENDITURE" && transition.to === "HEAD_REIMBURSEMENT_FINANCE")) {
    const receipt = await db.document.findFirst({
      where: {
        reimbursementClaimId: claim.id, kind: "PAYMENT_RECEIPT", isActive: true, recordTier: "HOT",
        createdAt: { gte: claim.paymentScheduleExportedAt ?? new Date() },
        uploadedBy: { memberships: { some: { role: "PAYMENT_INITIATOR", isActive: true } } },
      },
      select: { id: true },
    });
    if (!receipt) throw new Error("The Initiator must attach payment evidence before returning the paid packet.");
  }

  const now = new Date();
  const note = input.note?.trim();
  const updated = await db.$transaction(async (tx) => {
    if (isIndividuallyAssignedClaimRole(transition.from)) {
      const assignedItem = await tx.workItem.findFirst({
        where: { reimbursementClaimId: claim.id, assignedRole: transition.from, app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN" },
        select: { id: true, assignedUserId: true },
      });
      if (assignedItem?.assignedUserId && assignedItem.assignedUserId !== actor.id) {
        throw new Error("This packet was reassigned to another officer. Reload your claims list.");
      }
      if (assignedItem?.assignedUserId) {
        const closed = await tx.workItem.updateMany({
          where: { id: assignedItem.id, status: "OPEN", assignedUserId: actor.id },
          data: { status: "RESOLVED", resolvedAt: now },
        });
        if (closed.count !== 1) throw new Error("This packet changed while you were forwarding it. Reload and try again.");
      }
    }
    const result = await tx.reimbursementClaim.update({
      where: {
        id: claim.id,
        currentDesk: transition.from,
        status: transition.from === "COMPANY" ? "DRAFT" : "SUBMITTED",
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

    if (computationToConfirmId) {
      await tx.reimbursementComputationTable.update({
        where: { id: computationToConfirmId, status: "PREPARED" },
        data: { status: "CONFIRMED", confirmedById: actor.id, confirmedByName: actor.name, confirmedAt: now },
        select: { id: true },
      });
    }

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
        assignedUserId,
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
        assignedUserId,
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

    if (transition.from === "DIRECTOR_GENERAL" && transition.to === "DIRECTOR_FINANCE") {
      if (!claim.claimRecommendedAmount) throw new Error("The approved award amount is missing.");
      await tx.reimbursementVoucherSignoff.upsert({
        where: { reimbursementClaimId_kind: { reimbursementClaimId: claim.id, kind: "PAYMENT_APPROVED" } },
        create: {
          reimbursementClaimId: claim.id, kind: "PAYMENT_APPROVED", actorId: actor.id,
          actorRole: input.requesterRole, amount: claim.claimRecommendedAmount, remark: note ?? null,
        },
        update: {},
      });
    }

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
    role: Role;
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
      (membership) => membership.role === input.requesterRole && membership.areaOfficeId === input.areaOfficeId,
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
  DIRECTOR_GENERAL: "DIRECTOR_GENERAL",
  HEAD_REIMBURSEMENT_AUDIT: "HEAD_REIMBURSEMENT_AUDIT",
  REIMBURSEMENT_SCHEDULE_AUDITOR: "REIMBURSEMENT_SCHEDULE_AUDITOR",
  HEAD_BUDGET: "HEAD_BUDGET",
  BUDGET_OFFICER: "BUDGET_OFFICER",
  PRE_AUDIT_OFFICER: "PRE_AUDIT_OFFICER",
  HEAD_PRE_AUDIT: "HEAD_PRE_AUDIT",
  DIRECTOR_FINANCE: "DIRECTOR_FINANCE",
  HEAD_ACCOUNTS: "HEAD_ACCOUNTS",
  HEAD_REIMBURSEMENT_FINANCE: "HEAD_REIMBURSEMENT_FINANCE",
  REIMBURSEMENT_ACCOUNTANT: "REIMBURSEMENT_ACCOUNTANT",
  HEAD_EXPENDITURE: "HEAD_EXPENDITURE",
  EXPENDITURE_ACCOUNTANT: "EXPENDITURE_ACCOUNTANT",
  PAYMENT_INITIATOR: "PAYMENT_INITIATOR",
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

export function canSetClaimAuditStatus(input: { role: Role; desk: ClaimDesk; currentStatus?: ReimbursementAuditReviewStatus; nextStatus: ReimbursementAuditReviewStatus }) {
  const { role, desk, currentStatus, nextStatus } = input;
  if (!isAdminRole(role) && role !== desk) return false;
  if (desk === "REIMBURSEMENT_SCHEDULE_AUDITOR") return (nextStatus === "DRAFT" || nextStatus === "SUBMITTED") && (!currentStatus || currentStatus === "DRAFT");
  if (desk === "HEAD_REIMBURSEMENT_AUDIT") return nextStatus === "VERIFIED" && currentStatus === "SUBMITTED";
  if (desk === "DIRECTOR_AUDIT") return nextStatus === "CLEARED" && currentStatus === "VERIFIED";
  return false;
}

export function canSetPaymentFileAuditStatus(input: { role: Role; desk: ClaimDesk; currentStatus?: ReimbursementAuditReviewStatus; nextStatus: ReimbursementAuditReviewStatus }) {
  const { role, desk, currentStatus, nextStatus } = input;
  if (!isAdminRole(role) && role !== desk) return false;
  if (desk === "PRE_AUDIT_OFFICER") return (nextStatus === "DRAFT" || nextStatus === "SUBMITTED") && (!currentStatus || currentStatus === "DRAFT");
  if (desk === "HEAD_PRE_AUDIT") return nextStatus === "VERIFIED" && currentStatus === "SUBMITTED";
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

export async function markClaimKiv(input: ClaimRoutingInput, outcome: "KIV" | "DISAPPROVE" = "KIV") {
  if (!canManageClaimPause(input.requesterRole)) {
    throw new Error("Only Director General can mark a reimbursement claim KIV.");
  }

  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, name: true },
  });

  if (!actor) {
    throw new Error("User account was not found.");
  }

  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      status: "SUBMITTED",
      currentDesk: "DIRECTOR_GENERAL",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      company: { select: { legalName: true, organizationId: true, areaOfficeId: true, organization: { select: { workspaceId: true } } } },
    },
  });

  if (!claim) {
    throw new Error("An active reimbursement claim eligible for KIV was not found.");
  }

  const now = new Date();
  const note = input.note?.trim();
  if (outcome === "DISAPPROVE" && !note) throw new Error("Director General must record a disapproval reason.");
  const decisionLabel = outcome === "DISAPPROVE" ? "DISAPPROVED" : "KEEP IN VIEW";

  return db.$transaction(async (tx) => {
    const updated = await tx.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        status: outcome === "DISAPPROVE" ? "REJECTED" : "CHANGES_REQUESTED",
        currentDesk: "HEAD_OF_DIVISION",
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

    await tx.workItem.upsert({
      where: { sourceKey: getClaimWorkItemSourceKey(claim.id, "HEAD_OF_DIVISION") },
      create: {
        workspaceId: claim.company.organization.workspaceId,
        organizationId: claim.company.organizationId,
        areaOfficeId: claim.company.areaOfficeId,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        assignedRole: "HEAD_OF_DIVISION",
        app: "REIMBURSEMENT",
        kind: "REIMBURSEMENT_CLAIM_REVIEW",
        status: "OPEN",
        priority: "HIGH",
        title: `${decisionLabel} — DG decision`,
        summary: `${claim.company.legalName} has a ${decisionLabel} reimbursement packet for review.`,
        targetHref: `/claims/${claim.id}`,
        sourceKey: getClaimWorkItemSourceKey(claim.id, "HEAD_OF_DIVISION"),
      },
      update: { status: "OPEN", resolvedAt: null, emailNotifiedAt: null, priority: "HIGH", title: `${decisionLabel} — DG decision`, summary: `${claim.company.legalName} has a ${decisionLabel} reimbursement packet for review.` },
      select: { id: true },
    });

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: outcome === "DISAPPROVE" ? "REJECT" : "REQUEST_CHANGES",
        reason: [outcome === "DISAPPROVE" ? "Director General disapproved reimbursement claim." : "Director General marked reimbursement claim KIV/paused.", note]
          .filter(Boolean)
          .join(" "),
      },
    });

    return updated;
  });
}

export async function disapproveClaimAtDirectorGeneral(input: ClaimRoutingInput) {
  return markClaimKiv(input, "DISAPPROVE");
}

export async function resumeClaimFromKiv(input: ClaimRoutingInput) {
  if (input.requesterRole !== "HEAD_OF_DIVISION" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only Head of Reimbursement Division can return a KIV claim to Director General.");
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
      currentDesk: "HEAD_OF_DIVISION",
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
      status: true,
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

  const note = input.note?.trim();
  if (!note) throw new Error("Record the instruction to return this KIV claim to Director General.");

  return db.$transaction(async (tx) => {
    const updated = await tx.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        status: "SUBMITTED",
        currentDesk: "DIRECTOR_GENERAL",
      },
      select: { id: true },
    });

    await tx.workItem.updateMany({
      where: { reimbursementClaimId: claim.id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    await tx.workItem.upsert({
      where: {
        sourceKey: getClaimWorkItemSourceKey(claim.id, "DIRECTOR_GENERAL"),
      },
      create: {
        workspaceId: claim.company.organization.workspaceId,
        organizationId: claim.company.organizationId,
        areaOfficeId: claim.company.areaOfficeId,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        assignedRole: "DIRECTOR_GENERAL",
        app: "REIMBURSEMENT",
        kind: "REIMBURSEMENT_CLAIM_REVIEW",
        status: "OPEN",
        priority: "NORMAL",
        title: "Resume KIV reimbursement claim",
        summary: `${claim.company.legalName} has a resumed KIV claim awaiting DG decision.`,
        targetHref: `/claims/${claim.id}`,
        sourceKey: getClaimWorkItemSourceKey(claim.id, "DIRECTOR_GENERAL"),
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        emailNotifiedAt: null,
        assignedRole: "DIRECTOR_GENERAL",
        priority: "NORMAL",
        title: "Resume KIV reimbursement claim",
        summary: `${claim.company.legalName} has a resumed KIV claim awaiting DG decision.`,
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
        reason: ["Head of Reimbursement Division resumed KIV claim and returned it to Director General.", note]
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
    select: { id: true, name: true },
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
      status: true,
      paymentScheduleReference: true,
      paymentScheduleExportedAt: true,
      bankName: true,
      accountNumber: true,
      sortCode: true,
      claimRecommendedAmount: true,
      voucherSignoffRequired: true,
      company: { select: { legalName: true, email: true, telephone: true } },
      currentDesk: true,
      decisions: { where: { reason: { startsWith: "Pre-Audit Officer returned reimbursement payment audit result" } }, select: { id: true }, take: 1 },
      workItems: { where: { assignedRole: "REIMBURSEMENT_ACCOUNTANT", app: "REIMBURSEMENT", recordTier: "HOT" }, select: { status: true, updatedAt: true }, take: 1 },
    },
  });

  if (!claim) {
    throw new Error("Reimbursement claim was not found.");
  }

  if (claim.status !== "SUBMITTED") {
    throw new Error("Payment handoff can only be updated for a submitted claim in the active workflow.");
  }

  if (!isAdminRole(input.requesterRole) && claim.currentDesk !== input.requesterRole) {
    throw new Error("Payment handoff can only be updated while the packet is at your desk.");
  }

  if (input.status === "PAID") {
    const returnedAccountantDesk = claim.workItems.some((item) => item.status === "OPEN" &&
      claim.paymentScheduleExportedAt && item.updatedAt > claim.paymentScheduleExportedAt);
    if (input.requesterRole !== "REIMBURSEMENT_ACCOUNTANT" || claim.currentDesk !== "REIMBURSEMENT_ACCOUNTANT" || !returnedAccountantDesk) {
      throw new Error("Only the Reimbursement Schedule Accountant may record payment at the third encounter, after the paid packet returns.");
    }
    const paymentEvidence = await db.document.findFirst({
      where: {
        reimbursementClaimId: claim.id, kind: "PAYMENT_RECEIPT", isActive: true, recordTier: "HOT",
        createdAt: { gte: claim.paymentScheduleExportedAt ?? new Date() },
        uploadedBy: { memberships: { some: { role: "PAYMENT_INITIATOR", isActive: true } } },
      },
      select: { id: true },
    });
    if (!paymentEvidence) throw new Error("The Initiator's payment evidence must be attached before recording payment.");
    if (!input.paymentSystemReference?.trim()) throw new Error("Record the payment reference before settling the claim.");
    const eligibility = await verifyAnnualEligibility(claim.companyId, claim.claimYear ?? 0);
    if (eligibility.status !== "ELIGIBLE") throw new Error(`Payment is blocked: ${eligibility.message}`);
  }

  if (input.status === "EXPORTED") {
    if (input.requesterRole !== "REIMBURSEMENT_ACCOUNTANT" || claim.currentDesk !== "REIMBURSEMENT_ACCOUNTANT" || !claim.decisions.length) {
      throw new Error("Only the Reimbursement Schedule Accountant may create the e-payment schedule at the second encounter, after pre-audit.");
    }
    if (claim.paymentScheduleExportedAt) throw new Error("The e-payment schedule has already been created.");
    validateReimbursementPaymentSchedule({
      ...claim,
      itfReceiptNumber: null,
      claimRecommendedInWords: null,
      paymentScheduleReference: claim.paymentScheduleReference,
      paymentHandoffStatus: "EXPORTED",
      paymentAccountType: input.paymentAccountType?.trim() ?? null,
      paymentWithholdingTax: input.paymentWithholdingTax === undefined ? null : { toString: () => String(input.paymentWithholdingTax) },
      paymentTaxOffset: input.paymentTaxOffset === undefined ? null : { toString: () => String(input.paymentTaxOffset) },
      company: { ...claim.company, itfEmployerNumber: null, areaOffice: null },
    });
  }
  if (input.status === "PV_RAISED" &&
    (input.requesterRole !== "REIMBURSEMENT_ACCOUNTANT" || claim.currentDesk !== "REIMBURSEMENT_ACCOUNTANT" || claim.decisions.length)) {
    throw new Error("Only the Reimbursement Schedule Accountant may raise the payment voucher at the first encounter.");
  }
  if (input.status === "PV_RAISED" && (!claim.bankName || !claim.accountNumber || !claim.claimRecommendedAmount || Number(claim.claimRecommendedAmount.toString()) <= 0)) {
    throw new Error("A bank, account number, and approved award amount are required to raise the payment voucher.");
  }
  if (input.status === "SENT_TO_PAYMENT_SYSTEM" && !claim.paymentScheduleExportedAt) {
    throw new Error("The e-payment schedule must be created before it can be sent to a payment system.");
  }

  const now = new Date();
  const note = input.note?.trim();
  const scheduleReference = input.status === "EXPORTED"
    ? buildReimbursementPaymentScheduleReference(claim)
    : claim.paymentScheduleReference;

  return db.$transaction(async (tx) => {
    const archiveSource = input.status === "PAID" ? await tx.reimbursementClaim.findUniqueOrThrow({
      where: { id: claim.id },
      select: {
        reference: true, claimYear: true, claimRecommendedAmount: true, claimRecommendedInWords: true, paymentScheduleReference: true,
        paymentWithholdingTax: true, paymentTaxOffset: true, bankName: true, accountNumber: true,
        company: { select: { legalName: true, businessAddress: true, areaOffice: { select: { name: true } } } },
        voucherSignoffs: { orderBy: { signedAt: "asc" }, select: { kind: true, actorRole: true, amount: true, remark: true, signedAt: true, actor: { select: { name: true } } } },
        documents: { where: { isActive: true, recordTier: "HOT" }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true, createdAt: true } },
        trainingRequests: { select: { trainingRequest: { select: { id: true, title: true, approvalReference: true } } } },
        computationTables: { where: { recordTier: "HOT" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: {
          amountRecommended: true, recommendedContributionPercent: true, confirmedByName: true,
          rows: { orderBy: { sortOrder: "asc" }, select: { areaOfTraining: true, equivalentAmountOfContribution: true, expenditureClaimed: true, amountAwardedLowerOfContributionOrClaim: true, remarks: true } },
        } },
        decisions: { orderBy: { createdAt: "asc" }, select: { action: true, reason: true, createdAt: true, actor: { select: { name: true } } } },
      },
    }) : null;
    const archiveSnapshot = archiveSource ? {
      version: 1, archivedAt: now.toISOString(), reference: archiveSource.reference,
      claimYear: archiveSource.claimYear, companyName: archiveSource.company.legalName,
      areaOffice: archiveSource.company.areaOffice?.name ?? null,
      approvedAmount: archiveSource.claimRecommendedAmount?.toString() ?? null,
      amountInWords: archiveSource.claimRecommendedInWords,
      companyAddress: archiveSource.company.businessAddress,
      scheduleReference: archiveSource.paymentScheduleReference,
      withholdingTax: archiveSource.paymentWithholdingTax?.toString() ?? null,
      taxOffset: archiveSource.paymentTaxOffset?.toString() ?? null,
      bankName: archiveSource.bankName,
      accountNumber: archiveSource.accountNumber,
      accountNumberLast4: archiveSource.accountNumber?.slice(-4) ?? null,
      paymentReference: input.paymentSystemReference?.trim() ?? null,
      voucherRaised: archiveSource.decisions.find((decision) => decision.reason?.startsWith("Updated reimbursement payment handoff status to PV RAISED"))?.createdAt.toISOString() ?? null,
      voucherPreparedBy: archiveSource.voucherSignoffs.find((signoff) => signoff.kind === "PV_PREPARED")?.actor.name ?? null,
      signoffs: [
        ...archiveSource.voucherSignoffs.map((signoff) => ({ kind: signoff.kind, officer: signoff.actor.name, role: signoff.actorRole, amount: signoff.amount.toString(), remark: signoff.remark, signedAt: signoff.signedAt.toISOString() })),
        { kind: "PAYMENT_RECORDED", officer: actor.name, role: input.requesterRole, amount: archiveSource.claimRecommendedAmount?.toString() ?? "0", remark: note ?? null, signedAt: now.toISOString() },
      ],
      evidence: archiveSource.documents.map((document) => ({ id: document.id, kind: document.kind, fileName: document.fileName, uploadedAt: document.createdAt.toISOString() })),
      trainings: archiveSource.trainingRequests.map(({ trainingRequest }) => ({ id: trainingRequest.id, title: trainingRequest.title, approvalReference: trainingRequest.approvalReference })),
      hqComputation: archiveSource.computationTables[0] ? {
        amountRecommended: archiveSource.computationTables[0].amountRecommended.toString(),
        recommendedContributionPercent: archiveSource.computationTables[0].recommendedContributionPercent?.toString() ?? null,
        confirmedBy: archiveSource.computationTables[0].confirmedByName,
        rows: archiveSource.computationTables[0].rows.map((row) => ({
          area: row.areaOfTraining, equivalentContribution: row.equivalentAmountOfContribution?.toString() ?? null,
          expenditureClaimed: row.expenditureClaimed?.toString() ?? null,
          awarded: row.amountAwardedLowerOfContributionOrClaim?.toString() ?? null, remarks: row.remarks,
        })),
      } : null,
      decisions: [
        ...archiveSource.decisions.map((decision) => ({ action: decision.action, reason: decision.reason, officer: decision.actor.name, at: decision.createdAt.toISOString() })),
        { action: "SETTLE", reason: `Payment recorded. Reference: ${input.paymentSystemReference?.trim() ?? "Not recorded"}. ${note ?? ""}`.trim(), officer: actor.name, at: now.toISOString() },
      ],
    } : undefined;
    const updated = await tx.reimbursementClaim.update({
      where: input.status === "EXPORTED"
        ? { id: claim.id, currentDesk: "REIMBURSEMENT_ACCOUNTANT", paymentScheduleExportedAt: null }
        : input.status === "PAID"
          ? { id: claim.id, currentDesk: "REIMBURSEMENT_ACCOUNTANT", status: "SUBMITTED" }
          : { id: claim.id },
      data: {
        paymentHandoffStatus: input.status,
        voucherSignoffRequired: input.status === "PV_RAISED" ? true : undefined,
        archivedAt: input.status === "PAID" ? now : undefined,
        archiveSnapshot,
        paymentScheduleReference: scheduleReference,
        paymentScheduleExportedAt: input.status === "EXPORTED" ? now : undefined,
        paymentScheduleExportedById: input.status === "EXPORTED" ? actor.id : undefined,
        paymentAccountType: input.status === "EXPORTED" ? input.paymentAccountType?.trim() : undefined,
        paymentWithholdingTax: input.status === "EXPORTED" ? input.paymentWithholdingTax : undefined,
        paymentTaxOffset: input.status === "EXPORTED" ? input.paymentTaxOffset : undefined,
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
        status: input.status === "PAID" ? "ARCHIVED" : undefined,
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

    if ((input.status === "PV_RAISED" || input.status === "PAID") && claim.claimRecommendedAmount) {
      await tx.reimbursementVoucherSignoff.create({
        data: {
          reimbursementClaimId: claim.id, actorId: actor.id, actorRole: input.requesterRole,
          kind: input.status === "PV_RAISED" ? "PV_PREPARED" : "PAYMENT_RECORDED",
          amount: claim.claimRecommendedAmount,
          remark: note ?? null,
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

  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, isActive: true, memberships: { where: { isActive: true }, select: { role: true, workspaceId: true } } },
  });

  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      recordTier: "HOT",
      status: "SUBMITTED",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      currentDesk: true,
      computationRequired: true,
      computationTables: { where: { recordTier: "HOT" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { amountRecommended: true, status: true } },
      decisions: { where: { reason: { startsWith: "Head Reimbursement Audit returned the claim to" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { createdAt: true } },
      auditReview: { select: { status: true } },
      calculationSnapshots: {
        where: { stage: { in: ["AUDIT", "HEADQUARTERS"] }, recordTier: "HOT" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { stage: true, totalAmountAwarded: true, createdAt: true },
      },
      company: { select: { organization: { select: { workspaceId: true } } } },
    },
  });

  if (!claim) throw new Error("An active submitted reimbursement claim was not found.");
  if (!actor?.isActive || (!isAdminRole(input.requesterRole) && !actor.memberships.some((membership) =>
    membership.role === input.requesterRole && membership.workspaceId === claim.company.organization.workspaceId
  ))) throw new Error("You do not have Headquarters access to this claim.");
  if (!canSetClaimAuditStatus({ role: input.requesterRole, desk: claim.currentDesk, currentStatus: claim.auditReview?.status, nextStatus: input.status })) {
    throw new Error("This claim-audit decision is not available at the current desk or review stage.");
  }
  const headquartersAmount = claim.computationRequired
    ? (claim.computationTables[0]?.status === "CONFIRMED" ? claim.computationTables[0].amountRecommended : null)
    : claim.calculationSnapshots.find((snapshot) => snapshot.stage === "HEADQUARTERS")?.totalAmountAwarded;
  if (!headquartersAmount) throw new Error("The HQ reviewed calculation is required before claim audit.");
  const lastAuditReturnAt = claim.decisions[0]?.createdAt;
  const auditAmount = claim.calculationSnapshots.find((snapshot) => snapshot.stage === "AUDIT" && (!lastAuditReturnAt || snapshot.createdAt > lastAuditReturnAt))?.totalAmountAwarded;
  const determinedAmount = auditAmount ?? headquartersAmount;
  const varianceAmount = Math.round((Number(determinedAmount.toString()) - Number(headquartersAmount.toString())) * 100) / 100;
  if (input.status === "SUBMITTED" && !input.observations?.trim()) throw new Error("The Schedule Auditor must record audit observations.");
  if ((input.status === "VERIFIED" || input.status === "CLEARED") && !input.note?.trim()) throw new Error("Record a review decision note.");

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
        auditedAmount: input.status === "SUBMITTED" ? determinedAmount : undefined,
        varianceAmount: input.status === "SUBMITTED" ? varianceAmount : undefined,
        preparedById: input.status === "SUBMITTED" ? actor.id : undefined,
        preparedAt: input.status === "SUBMITTED" ? now : undefined,
        verifiedById: input.status === "VERIFIED" ? actor.id : undefined,
        verifiedAt: input.status === "VERIFIED" ? now : undefined,
      },
      update: {
        status: input.status,
        observations: input.status === "DRAFT" || input.status === "SUBMITTED" ? input.observations : undefined,
        recommendation: input.status === "DRAFT" || input.status === "SUBMITTED" ? input.recommendation : undefined,
        auditedAmount: input.status === "SUBMITTED" ? determinedAmount : undefined,
        varianceAmount: input.status === "SUBMITTED" ? varianceAmount : undefined,
        preparedById: input.status === "SUBMITTED" ? actor.id : undefined,
        preparedAt: input.status === "SUBMITTED" ? now : undefined,
        verifiedById: input.status === "VERIFIED" ? actor.id : undefined,
        verifiedAt: input.status === "VERIFIED" ? now : undefined,
      },
      select: {
        id: true,
      },
    });

    if (input.status === "CLEARED") {
      await tx.reimbursementClaim.update({
        where: { id: claim.id },
        data: { claimRecommendedAmount: determinedAmount, claimRecommendedInWords: nairaInWords(Number(determinedAmount.toString())) },
        select: { id: true },
      });
    }

    await tx.decision.create({
      data: {
        actorId: actor.id,
        companyId: claim.companyId,
        reimbursementClaimId: claim.id,
        action: getAuditReviewDecisionAction(input.status),
        reason: [
          `Claim audit ${input.status.toLowerCase()}.`,
          input.status === "SUBMITTED" ? `Audited amount: NGN ${Number(determinedAmount.toString()).toFixed(2)}.` : undefined,
          input.status === "SUBMITTED" && auditAmount ? "Independent Schedule Auditor recalculation used." : undefined,
          input.status === "SUBMITTED" ? input.observations : input.note,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return auditReview;
  });
}

export async function updatePaymentFileAudit(input: UpdatePaymentFileAuditInput) {
  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, isActive: true, memberships: { where: { isActive: true }, select: { role: true, workspaceId: true } } },
  });
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", status: "SUBMITTED", company: { recordTier: "HOT", isActive: true } },
    select: {
      id: true, companyId: true, currentDesk: true, bankName: true, accountNumber: true, sortCode: true,
      claimRecommendedAmount: true, paymentHandoffStatus: true,
      paymentFileAudit: { select: { status: true, voucherChecked: true, budgetChecked: true, bankDetailsChecked: true, amountChecked: true } },
      decisions: {
        where: { reason: { startsWith: "Head Budget forwarded budget-cleared reimbursement payment file" } },
        select: { id: true }, take: 1,
      },
      company: { select: { organization: { select: { workspaceId: true } } } },
    },
  });
  if (!claim) throw new Error("An active submitted reimbursement claim was not found.");
  if (!actor?.isActive || (!isAdminRole(input.requesterRole) && !actor.memberships.some((membership) =>
    membership.role === input.requesterRole && membership.workspaceId === claim.company.organization.workspaceId
  ))) throw new Error("You do not have Headquarters access to this payment file.");
  if (!canSetPaymentFileAuditStatus({ role: input.requesterRole, desk: claim.currentDesk, currentStatus: claim.paymentFileAudit?.status, nextStatus: input.status })) {
    throw new Error("This payment-file pre-audit decision is not available at the current desk or review stage.");
  }
  if (input.status === "SUBMITTED") {
    if (!input.voucherChecked || !input.budgetChecked || !input.bankDetailsChecked || !input.amountChecked) {
      throw new Error("Complete all four payment-file checks before submitting pre-audit.");
    }
    if (!claim.decisions.length) throw new Error("Budget clearance is missing from this payment packet.");
    if (claim.paymentHandoffStatus !== "PV_RAISED") {
      const voucher = await db.decision.findFirst({
        where: { reimbursementClaimId: claim.id, reason: { startsWith: "Updated reimbursement payment handoff status to PV RAISED" } },
        select: { id: true },
      });
      if (!voucher) throw new Error("A raised payment voucher is missing from this payment packet.");
    }
    if (!claim.bankName || !claim.accountNumber || !claim.sortCode) throw new Error("Bank details are incomplete.");
    if (!claim.claimRecommendedAmount) throw new Error("The approved claim amount is missing.");
  }
  if (input.status === "VERIFIED" && !input.note?.trim()) throw new Error("Head Pre-Audit must record a verification note.");

  const now = new Date();
  return db.$transaction(async (tx) => {
    const review = await tx.reimbursementPaymentFileAudit.upsert({
      where: { reimbursementClaimId: claim.id },
      create: {
        reimbursementClaimId: claim.id,
        status: input.status,
        voucherChecked: Boolean(input.voucherChecked),
        budgetChecked: Boolean(input.budgetChecked),
        bankDetailsChecked: Boolean(input.bankDetailsChecked),
        amountChecked: Boolean(input.amountChecked),
        observations: input.observations,
        preparedById: input.status === "SUBMITTED" ? actor.id : undefined,
        preparedAt: input.status === "SUBMITTED" ? now : undefined,
        verifiedById: input.status === "VERIFIED" ? actor.id : undefined,
        verifiedAt: input.status === "VERIFIED" ? now : undefined,
      },
      update: {
        status: input.status,
        voucherChecked: input.status === "VERIFIED" ? undefined : Boolean(input.voucherChecked),
        budgetChecked: input.status === "VERIFIED" ? undefined : Boolean(input.budgetChecked),
        bankDetailsChecked: input.status === "VERIFIED" ? undefined : Boolean(input.bankDetailsChecked),
        amountChecked: input.status === "VERIFIED" ? undefined : Boolean(input.amountChecked),
        observations: input.status === "VERIFIED" ? undefined : input.observations,
        preparedById: input.status === "SUBMITTED" ? actor.id : undefined,
        preparedAt: input.status === "SUBMITTED" ? now : undefined,
        verifiedById: input.status === "VERIFIED" ? actor.id : undefined,
        verifiedAt: input.status === "VERIFIED" ? now : undefined,
      },
      select: { id: true },
    });
    await tx.decision.create({
      data: {
        actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id,
        action: getAuditReviewDecisionAction(input.status),
        reason: [
          `Payment-file pre-audit ${input.status.toLowerCase()}.`,
          input.status === "VERIFIED" ? input.note : input.observations,
        ].filter(Boolean).join(" "),
      },
    });
    return review;
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
      currentDesk: true,
      status: true,
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

  if (claim.status === "ARCHIVED") throw new Error("Archived claims cannot accept new evidence.");

  if (input.requesterRole === "PAYMENT_INITIATOR" &&
    (claim.currentDesk !== "PAYMENT_INITIATOR" || input.kind !== "PAYMENT_RECEIPT")) {
    throw new Error("The Initiator may upload only payment evidence while the packet is at their desk.");
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
  if (isItfRole(input.requesterRole)) {
    throw new Error("Form 1B amounts are determined by the RO calculations and the claim-audit approval workflow.");
  }
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
      status: { not: "ARCHIVED" },
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
    await tx.reimbursementClaim.update({ where: { id: claim.id }, data: { computationRequired: true, lines: { create: lines } }, select: { id: true } });
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

export async function saveHqComputationTable(input: SaveHqComputationTableInput) {
  if (input.requesterRole !== "HQ_REIMBURSEMENT_OFFICER" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only the HQ Reimbursement Officer may prepare the computation table.");
  }
  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", status: "SUBMITTED", currentDesk: "HQ_REIMBURSEMENT_OFFICER" },
    select: {
      id: true, companyId: true, claimYear: true, trainingContributionPaid: true, itfReceiptNumber: true,
      company: { select: { legalName: true, itfEmployerNumber: true, areaOffice: { select: { name: true } }, organization: { select: { workspaceId: true } } } },
      calculationSnapshots: { where: { stage: "HEADQUARTERS", recordTier: "HOT" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, createdAt: true } },
      lines: { where: { stage: "HEADQUARTERS" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: {
        id: true, awardArea: true, trainingArea: true, emphasisNumber: true, totalWorkforce: true, totalTrained: true,
        percentTrained: true, percentAwarded: true,
      } },
    },
  });
  if (!claim?.calculationSnapshots.length || !claim.trainingContributionPaid || !claim.lines.length) {
    throw new Error("Save the HQ Form 1B calculation before preparing its computation table.");
  }
  const contributionPaid = claim.trainingContributionPaid;
  const actor = await db.user.findFirst({
    where: { email: input.requesterEmail, isActive: true, memberships: { some: { isActive: true, role: input.requesterRole, workspaceId: claim.company.organization.workspaceId } } },
    select: { id: true, name: true },
  });
  if (!actor) throw new Error("You do not have access to prepare this HQ computation table.");
  if (input.rows.length !== claim.lines.length || new Set(input.rows.map((row) => row.lineId)).size !== claim.lines.length) {
    throw new Error("Provide verified expenditure for every current HQ calculation row.");
  }
  const supplied = new Map(input.rows.map((row) => [row.lineId, row]));
  const summary = buildHqComputationTableSummary({
    contributionPaid: Number(contributionPaid.toString()),
    rows: claim.lines.map((line) => {
      const row = supplied.get(line.id);
      if (!row) throw new Error("The HQ calculation changed. Reload the claim and prepare the table again.");
      return {
        emphasis: line.emphasisNumber ?? undefined, areaOfTraining: line.trainingArea,
        totalEmployees: line.totalWorkforce ?? undefined, numberTrained: line.totalTrained ?? undefined,
        percentTrained: line.percentTrained ? Number(line.percentTrained.toString()) : undefined,
        maxPercentClaimable: getClaimMaxPercentClaimable(line.awardArea, line.emphasisNumber),
        percentTrainingContributionAwarded: line.percentAwarded ? Number(line.percentAwarded.toString()) : 0,
        expenditureClaimed: row.expenditureClaimed, remarks: row.remarks.trim() || undefined,
      };
    }),
  });
  await db.$transaction(async (tx) => {
    const stillCurrent = await tx.reimbursementClaim.findFirst({
      where: { id: claim.id, status: "SUBMITTED", currentDesk: "HQ_REIMBURSEMENT_OFFICER" }, select: { id: true },
    });
    if (!stillCurrent) throw new Error("The claim moved from the HQ RO desk. Reload it before preparing the table.");
    const latestSnapshot = await tx.reimbursementCalculationSnapshot.findFirst({
      where: { reimbursementClaimId: claim.id, stage: "HEADQUARTERS", recordTier: "HOT" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true },
    });
    if (latestSnapshot?.id !== claim.calculationSnapshots[0].id) throw new Error("The HQ calculation changed. Reload the claim before preparing its table.");
    await tx.reimbursementComputationTable.create({
      data: {
        reimbursementClaimId: claim.id, companyName: claim.company.legalName,
        itfEmployerNumber: claim.company.itfEmployerNumber, claimYear: claim.claimYear,
        contributionPaid, receiptNumber: claim.itfReceiptNumber,
        fiftyPercentOfContribution: summary.fiftyPercentOfContribution,
        areaOfficeName: claim.company.areaOffice?.name ?? null,
        amountRecommended: summary.amountRecommended,
        amountRecommendedInWords: nairaInWords(summary.amountRecommended),
        recommendedContributionPercent: summary.recommendedContributionPercent,
        preparedById: actor.id, preparedByName: actor.name, preparedAt: new Date(), status: "PREPARED",
        rows: { create: summary.rows.map((row) => ({
          sortOrder: row.sortOrder, emphasis: row.emphasis, areaOfTraining: row.areaOfTraining,
          totalEmployees: row.totalEmployees, numberTrained: row.numberTrained,
          percentTrained: row.percentTrained, maxPercentClaimable: row.maxPercentClaimable,
          percentTrainingContributionAwarded: row.percentTrainingContributionAwarded,
          equivalentAmountOfContribution: row.equivalentAmountOfContribution,
          expenditureClaimed: row.expenditureClaimed,
          amountAwardedLowerOfContributionOrClaim: row.amountAwardedLowerOfContributionOrClaim,
          remarks: row.remarks,
        })) },
      }, select: { id: true },
    });
    await tx.decision.create({ data: {
      actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id,
      action: "RECOMMEND", reason: `HQ RO prepared the computation table with verified expenditure. Recommended NGN ${summary.amountRecommended.toFixed(2)}.`,
    } });
  });
  return summary;
}

function getClaimMaxPercentClaimable(area: string | null, emphasis: number | null) {
  if (["MANAGEMENT", "SUPERVISORY", "OCCUPATIONAL"].includes(area ?? "")) {
    return ({ 1: 15, 2: 13, 3: 11 } as Record<number, number>)[emphasis ?? 0] ?? 0;
  }
  return ({ SMALL_SCALE_TRAINING: 48, LEARNING_DEVELOPMENT_PERSONNEL: 2, HEALTH_SAFETY_ENVIRONMENT: 6, SIWES: 2, TRAINING_PLAN: 1 } as Record<string, number>)[area ?? ""] ?? 0;
}

export async function calculateAuditorClaim(input: CalculateAuditorClaimInput) {
  if (input.requesterRole !== "REIMBURSEMENT_SCHEDULE_AUDITOR" && !isAdminRole(input.requesterRole)) {
    throw new Error("Only the Reimbursement Schedule Auditor may recalculate this claim.");
  }
  const remarks = input.reviewerRemarks.trim();
  if (!remarks) throw new Error("Record the discrepancy and reason for this independent recalculation.");
  if (!input.reviewedForm1A || !input.reviewedForm2A || !input.reviewedEvidence) {
    throw new Error("Confirm Form 1A, Form 2A and supporting evidence were reviewed.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", status: "SUBMITTED", currentDesk: "REIMBURSEMENT_SCHEDULE_AUDITOR" },
    select: {
      id: true, companyId: true, employerScale: true, trainingContributionPaid: true, policyEdition: true,
      auditReview: { select: { status: true } },
      company: { select: { organization: { select: { workspaceId: true } } } },
      lines: { where: { stage: "EMPLOYER" }, select: { stage: true, awardArea: true, totalWorkforce: true, totalTrained: true, emphasisNumber: true, percentAwarded: true } },
      calculationSnapshots: { where: { stage: "HEADQUARTERS", recordTier: "HOT" }, select: { id: true }, take: 1 },
    },
  });
  if (!claim) throw new Error("This claim is not at the Schedule Auditor desk.");
  if (claim.auditReview && claim.auditReview.status !== "DRAFT") throw new Error("The claim audit has already been submitted.");
  if (!claim.calculationSnapshots.length) throw new Error("The HQ calculation must exist before independent audit recalculation.");
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, isActive: true, memberships: { where: { isActive: true }, select: { role: true, workspaceId: true } } },
  });
  if (!actor?.isActive || (!isAdminRole(input.requesterRole) && !actor.memberships.some((membership) =>
    membership.role === "REIMBURSEMENT_SCHEDULE_AUDITOR" && membership.workspaceId === claim.company.organization.workspaceId
  ))) throw new Error("You do not have Headquarters access to this claim.");

  const baseline = getAreaOfficeCalculationBaseline(claim);
  if (!baseline) throw new Error("The employer calculation cannot be reconstructed for audit.");
  const calculation = applyAreaOfficeVerifiedCounts(baseline, input.verified);
  const result = calculateReimbursementAward({ ...calculation, policyEdition: claim.policyEdition });
  const lines = result.lines.map((line) => ({
    ...buildEmployerCalculationLine(line, calculation.trainingContributionPaid, calculation),
    stage: "AUDIT" as const,
  }));

  return db.$transaction(async (tx) => {
    await tx.reimbursementClaimLine.deleteMany({ where: { reimbursementClaimId: claim.id, stage: "AUDIT" } });
    await tx.reimbursementClaim.update({ where: { id: claim.id }, data: { lines: { create: lines } }, select: { id: true } });
    const snapshot = await tx.reimbursementCalculationSnapshot.create({
      data: {
        reimbursementClaimId: claim.id, stage: "AUDIT", policyEdition: claim.policyEdition,
        employerScale: calculation.employerScale, calculatedByEmail: input.requesterEmail,
        calculationInput: calculation, calculationResult: result,
        uncappedAwardPercent: result.uncappedTotalAwardPercent,
        cappedAwardPercent: result.cappedTotalAwardPercent,
        totalAmountAwarded: result.totalAmountAwarded, reviewerRemarks: remarks,
      },
      select: { id: true },
    });
    await tx.decision.create({
      data: {
        actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id,
        action: "RECOMMEND",
        reason: `Schedule Auditor independently recalculated the claim to NGN ${result.totalAmountAwarded.toFixed(2)}. ${remarks}`,
      },
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
      status: { not: "ARCHIVED" },
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
