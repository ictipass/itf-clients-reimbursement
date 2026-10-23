import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { ClaimBankFields } from "@/components/claim-bank-fields";
import { ClaimTestClockNotice } from "@/components/claim-test-clock-notice";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  addClaimLineAction,
  attachTrainingsToClaimAction,
  deleteClaimLineAction,
  detachTrainingFromClaimAction,
  forwardClaimAlongWorkflowAction,
  forwardClaimToAreaReimbursementOfficerAction,
  forwardClaimToHeadOfTrainingAction,
  markClaimKivAction,
  recheckClaimAnnualPaymentAction,
  resumeClaimFromKivAction,
  submitClaimToAreaManagerAction,
  updateClaimStaffEntriesAction,
  updateClaimAuditReviewAction,
  updateClaimLineAction,
  updateEmployerClaimCalculationAction,
  updateClaimContributionVerificationAction,
  updateClaimPaymentHandoffAction,
  updateClaimRecommendationAction,
  updateClaimFormAction,
  uploadClaimEvidenceAction,
} from "@/app/(dashboard)/claims/[claimId]/actions";
import { authOptions } from "@/lib/auth";
import { listActiveBankOptions } from "@/lib/bank-directory";
import {
  contributionVerificationSources,
  contributionVerificationStatuses,
  formatContributionVerificationSource,
  formatContributionVerificationStatus,
} from "@/lib/claim-verification";
import { CLAIM_SUBMISSION_DEADLINE_NOTICE } from "@/lib/claim-policy";
import {
  canRouteClaimFromDesk,
  getClaimEvidenceKinds,
  getClaimPostIntakeTransitions,
} from "@/lib/claims";
import { getDb } from "@/lib/db";
import { canUseSection } from "@/lib/feature-gates";
import {
  formatReimbursementAuditReviewStatus,
  reimbursementAuditReviewStatuses,
} from "@/lib/reimbursement-audit-review";
import {
  formatReimbursementPaymentHandoffStatus,
  reimbursementPaymentHandoffStatuses,
} from "@/lib/reimbursement-payment-schedule";
import { formatReimbursementPolicyEdition } from "@/lib/reimbursement-policy";
import { isItfRole } from "@/lib/rbac";

function formatMoney(value: { toString(): string } | null) {
  if (!value) {
    return "Not provided";
  }

  return `NGN ${Number(value.toString()).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function decimalInput(value: { toString(): string } | null) {
  return value?.toString() ?? "";
}

function CollapsibleClaimSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <details open className="group [&>section]:!mt-2">
    <summary className="mt-8 flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
      <span className="group-open:hidden">{title}</span>
      <span className="ml-auto hidden text-xs text-zinc-500 group-open:inline">Collapse section</span>
      <span className="ml-auto text-xs text-zinc-500 group-open:hidden">Expand section</span>
    </summary>
    {children}
  </details>;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDecisionAction(value: string) {
  return value.replaceAll("_", " ");
}

function formatPercent(value: { toString(): string } | null) {
  if (!value) {
    return "Not calculated";
  }

  return `${Number(value.toString()).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatStaffArea(value: string) {
  return value.replaceAll("_", " ");
}

function trainingAreaForCalculationRow(awardArea: string | null, trainingArea: string) {
  if (awardArea === "MANAGEMENT") return "management";
  if (awardArea === "SUPERVISORY") return "supervisory";
  if (awardArea === "OCCUPATIONAL") return "occupational";
  if (awardArea === "HEALTH_SAFETY_ENVIRONMENT") return "health & safety";
  if (awardArea === "SMALL_SCALE_TRAINING") return "all";
  if (awardArea) return null;
  return trainingArea.trim().toLowerCase();
}

export default async function ClaimDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ claimId: string }>;
  searchParams: Promise<{ paymentCheck?: string; paymentCheckError?: string; routingError?: string; lineSaved?: string; lineError?: string; formSaved?: string; formError?: string; assessmentSaved?: string; assessmentError?: string }>;
}>) {
  const { claimId } = await params;
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const canSubmitClaim = canUseSection(activeRole, "claim.form.edit");
  const canRecommendClaim = canUseSection(activeRole, "claim.recommendation.edit");
  const canUploadClaimEvidence = canUseSection(activeRole, "claim.evidence.upload");
  const evidenceKinds = getClaimEvidenceKinds();
  const claim = await getDb().reimbursementClaim.findFirst({
    where: {
      id: claimId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      reference: true,
      claimYear: true,
      employerScale: true,
      trainingContributionDue: true,
      trainingContributionPaid: true,
      itfReceiptNumber: true,
      contributionVerificationStatus: true,
      contributionVerificationSource: true,
      contributionVerifiedAt: true,
      contributionVerificationNote: true,
      externalVerificationProvider: true,
      externalVerificationReference: true,
      externalVerificationCheckedAt: true,
      externalVerificationMessage: true,
      paymentHandoffStatus: true,
      paymentScheduleReference: true,
      paymentScheduleExportedAt: true,
      paymentSystemReference: true,
      paymentSystemStatus: true,
      paymentSystemSyncedAt: true,
      paidAt: true,
      bankName: true,
      accountNumber: true,
      sortCode: true,
      claimedAmount: true,
      eligibleAmount: true,
      claimRecommendedAmount: true,
      claimRecommendedInWords: true,
      uncappedAwardPercent: true,
      cappedAwardPercent: true,
      calculatedAwardAmount: true,
      paymentDetails: true,
      employerOfficerName: true,
      employerOfficerRank: true,
      chiefExecutiveName: true,
      employerDeclaredAt: true,
      status: true,
      currentDesk: true,
      policyEdition: true,
      submittedAt: true,
      auditReview: {
        select: {
          status: true,
          observations: true,
          recommendation: true,
          auditedAmount: true,
          varianceAmount: true,
          preparedAt: true,
          verifiedAt: true,
          preparedBy: {
            select: {
              name: true,
            },
          },
          verifiedBy: {
            select: {
              name: true,
            },
          },
        },
      },
      decisions: {
        select: {
          id: true,
          action: true,
          reason: true,
          createdAt: true,
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 40,
      },
      documents: {
        where: {
          isActive: true,
          recordTier: "HOT",
        },
        select: {
          id: true,
          kind: true,
          fileName: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      lines: {
        select: {
          id: true,
          stage: true,
          awardArea: true,
          trainingArea: true,
          totalWorkforce: true,
          totalTrained: true,
          percentTrained: true,
          emphasisNumber: true,
          contributionPaid: true,
          employerClaimAmount: true,
          referencePage: true,
          percentAwarded: true,
          amountAwarded: true,
          remarks: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      staffEntries: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          employeeId: true,
          employeeName: true,
          trainingArea: true,
          duplicateGroupKey: true,
          duplicateDetectedAt: true,
        },
        orderBy: [{ trainingArea: "asc" }, { employeeId: "asc" }],
      },
      company: {
        select: {
          id: true,
          legalName: true,
          itfEmployerNumber: true,
          organization: { select: { workspaceId: true } },
          areaOffice: {
            select: {
              name: true,
            },
          },
        },
      },
      contributionVerifiedBy: {
        select: {
          name: true,
        },
      },
      trainingRequests: {
        select: {
          attachedAt: true,
          trainingRequest: {
            select: {
              id: true,
              title: true,
              approvalReference: true,
              startsAt: true,
              endsAt: true,
              estimatedCost: true,
              participants: { select: { trainingArea: true } },
            },
          },
        },
        orderBy: {
          attachedAt: "asc",
        },
      },
    },
  });

  if (!claim) {
    notFound();
  }
  const canEditCalculations = canUseSection(activeRole, "claim.calculation.edit") && !isItfRole(activeRole) && claim.status === "DRAFT";
  let approvedReimbursementStatus = "Pending ITF decision";
  if (claim.status === "REJECTED") approvedReimbursementStatus = "Not awarded";
  else if (["APPROVED", "SETTLED", "ARCHIVED"].includes(claim.status)) approvedReimbursementStatus = "See claim decision trail";
  const bankOptions = await listActiveBankOptions(claim.company.organization.workspaceId);

  const annualPaymentCheck = claim.claimYear && claim.company.id
    ? await getDb().annualEligibilityCheck.findUnique({
        where: { companyId_year: { companyId: claim.company.id, year: claim.claimYear } },
        select: { status: true, message: true, checkedAt: true },
      })
    : null;

  const canManageClaimTrainings = canSubmitClaim && claim.status === "DRAFT";
  const canSubmitToAreaManager =
    canSubmitClaim && claim.status === "DRAFT" && claim.currentDesk === "COMPANY";
  const canForwardToHot =
    claim.status === "SUBMITTED" &&
    claim.currentDesk === "AREA_MANAGER" &&
    (activeRole === "AREA_MANAGER" ||
      activeRole === "SYSTEM_ADMIN" ||
      activeRole === "WORKSPACE_APP_ADMIN");
  const canForwardToAreaReimbursementOfficer =
    claim.status === "SUBMITTED" &&
    claim.currentDesk === "HEAD_OF_TRAINING" &&
    (activeRole === "HEAD_OF_TRAINING" ||
      activeRole === "SYSTEM_ADMIN" ||
      activeRole === "WORKSPACE_APP_ADMIN");
  const canManageKiv =
    activeRole === "DIRECTOR_GENERAL" ||
    activeRole === "SYSTEM_ADMIN" ||
    activeRole === "WORKSPACE_APP_ADMIN";
  const canMarkKiv =
    canManageKiv && ["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(claim.status);
  const canResumeKiv = canManageKiv && claim.status === "CHANGES_REQUESTED";
  const canUpdatePaymentHandoff =
    activeRole === "DIRECTOR_FINANCE" ||
    activeRole === "HEAD_REIMBURSEMENT_FINANCE" ||
    activeRole === "REIMBURSEMENT_ACCOUNTANT" ||
    activeRole === "SYSTEM_ADMIN" ||
    activeRole === "WORKSPACE_APP_ADMIN";
  const canUpdateAuditReview =
    activeRole === "DIRECTOR_AUDIT" ||
    activeRole === "HEAD_REIMBURSEMENT_AUDIT" ||
    activeRole === "REIMBURSEMENT_SCHEDULE_AUDITOR" ||
    activeRole === "SYSTEM_ADMIN" ||
    activeRole === "WORKSPACE_APP_ADMIN";
  const canViewAuditReview = canUpdateAuditReview || Boolean(claim.auditReview);
  const latestRoutingReason = claim.decisions[0]?.reason ?? "";
  const availablePostIntakeTransitions = getClaimPostIntakeTransitions().filter((transition) => {
    if (claim.status !== "SUBMITTED" || claim.currentDesk !== transition.from) {
      return false;
    }

    if (!canRouteClaimFromDesk(activeRole, transition.from)) {
      return false;
    }

    if (transition.from === "HEAD_OF_DIVISION") {
      return latestRoutingReason.includes("HQ RO returned")
        ? transition.to === "DIRECTOR_FSD"
        : transition.to === "HQ_REIMBURSEMENT_OFFICER";
    }

    if (transition.from === "DIRECTOR_FSD") {
      return latestRoutingReason.includes("Head Reimbursement Division forwarded verified")
        ? transition.to === "DIRECTOR_AUDIT"
        : transition.to === "HEAD_OF_DIVISION";
    }

    if (transition.from === "HEAD_REIMBURSEMENT_AUDIT") {
      return latestRoutingReason.includes("Reimbursement Schedule Auditor returned")
        ? transition.to === "DIRECTOR_AUDIT"
        : transition.to === "REIMBURSEMENT_SCHEDULE_AUDITOR";
    }

    if (transition.from === "HEAD_BUDGET") {
      return latestRoutingReason.includes("Budget Officer returned")
        ? transition.to === "DIRECTOR_AUDIT"
        : transition.to === "BUDGET_OFFICER";
    }

    if (transition.from === "DIRECTOR_AUDIT") {
      if (latestRoutingReason.includes("Head Budget forwarded budget-cleared")) {
        return transition.to === "PRE_AUDIT_OFFICER";
      }

      if (latestRoutingReason.includes("Pre-Audit Officer returned")) {
        return false;
      }

      return latestRoutingReason.includes("Head Reimbursement Audit forwarded verified")
        ? transition.to === "DIRECTOR_FINANCE"
        : transition.to === "HEAD_REIMBURSEMENT_AUDIT";
    }

    return true;
  });
  const staffEntriesByArea = {
    MANAGEMENT: claim.staffEntries.filter((entry) => entry.trainingArea === "MANAGEMENT"),
    SUPERVISORY: claim.staffEntries.filter((entry) => entry.trainingArea === "SUPERVISORY"),
    OCCUPATIONAL: claim.staffEntries.filter((entry) => entry.trainingArea === "OCCUPATIONAL"),
  };
  const duplicateStaffEntries = claim.staffEntries.filter((entry) => entry.duplicateGroupKey);
  const unmatchedTrainings = claim.trainingRequests.filter(({ trainingRequest }) =>
    !claim.lines.some((line) => {
      const rowArea = trainingAreaForCalculationRow(line.awardArea, line.trainingArea);
      return rowArea && trainingRequest.participants.some(({ trainingArea }) =>
        trainingArea && (rowArea === "all" || trainingArea.trim().toLowerCase() === rowArea),
      );
    }),
  );
  const availableTrainings = canManageClaimTrainings
    ? await getDb().trainingRequest.findMany({
        where: {
          companyId: claim.company.id,
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
          title: true,
          approvalReference: true,
          startsAt: true,
          estimatedCost: true,
        },
        orderBy: {
          startsAt: "desc",
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/claims" className="text-sm font-semibold text-[#800020]">
          Back to Claims
        </Link>
        <Link href={`/registry/${claim.company.id}`} className="text-sm font-semibold text-zinc-700">
          Open company
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Claim Form 1
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{claim.reference}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Reimbursement claim for {claim.company.legalName}.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {claim.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4 text-sm font-black uppercase leading-6 tracking-wide text-red-900 shadow-sm">
        {CLAIM_SUBMISSION_DEADLINE_NOTICE}
      </div>
      <ClaimTestClockNotice />
      {query.routingError ? (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-900">{query.routingError}</p>
      ) : null}

      <div className="mt-4 rounded-lg border border-[#800020]/20 bg-[#800020]/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Claim policy edition
        </p>
        <p className="mt-1 text-lg font-semibold text-zinc-950">
          {formatReimbursementPolicyEdition(claim.policyEdition)}
        </p>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          This claim is locked to this reimbursement edition for calculation, review, and audit
          traceability.
        </p>
      </div>

      {claim.status === "CHANGES_REQUESTED" ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold">This reimbursement claim is currently KIV/paused.</p>
          <p>
            Attention badges are cleared while paused. Resume it only when the claim should return
            to the current desk: {claim.currentDesk.replaceAll("_", " ")}.
          </p>
        </div>
      ) : null}

      <CollapsibleClaimSection title="Claim overview">
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Company
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">{claim.company.legalName}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            ITF number
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {claim.company.itfEmployerNumber ?? "Pending"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Area Office
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {claim.company.areaOffice?.name ?? "No Area Office"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Claimed
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatMoney(claim.claimedAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Employer scale
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {claim.employerScale?.replaceAll("_", " ") ?? "Not selected"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Indicative reimbursement rate
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatPercent(claim.cappedAwardPercent)}
          </p>
          {claim.uncappedAwardPercent &&
          claim.cappedAwardPercent &&
          claim.uncappedAwardPercent.toString() !== claim.cappedAwardPercent.toString() ? (
            <p className="mt-1 text-xs text-zinc-500">
              Capped from {formatPercent(claim.uncappedAwardPercent)}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Estimated claim amount
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatMoney(claim.calculatedAwardAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Current desk
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {claim.currentDesk.replaceAll("_", " ")}
          </p>
          {claim.submittedAt ? (
            <p className="mt-1 text-xs text-zinc-500">
              Submitted{" "}
              {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                claim.submittedAt,
              )}
            </p>
          ) : null}
        </div>
      </section>
      </CollapsibleClaimSection>

      {(canSubmitToAreaManager ||
        canForwardToHot ||
        canForwardToAreaReimbursementOfficer ||
        availablePostIntakeTransitions.length > 0 ||
        canMarkKiv ||
        canResumeKiv) ? (
        <CollapsibleClaimSection title="Claim routing">
        <section className="mt-8 rounded-lg border border-[#800020]/20 bg-[#800020]/5 p-5">
          <h2 className="text-xl font-semibold tracking-tight">Claim routing</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Move this claim only when your desk has completed its current action. The attention
            badge follows this current desk, so the previous desk is cleared when you forward.
          </p>
          {canSubmitToAreaManager ? (
            <form
              action={submitClaimToAreaManagerAction.bind(null, claim.id)}
              className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <input
                name="note"
                placeholder="Optional submission note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Submit to Area Manager
              </button>
            </form>
          ) : null}
          {canForwardToHot ? (
            <form
              action={forwardClaimToHeadOfTrainingAction.bind(null, claim.id)}
              className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <input
                name="note"
                placeholder="Optional Area Manager note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Forward to HOT
              </button>
            </form>
          ) : null}
          {canForwardToAreaReimbursementOfficer ? (
            <form
              action={forwardClaimToAreaReimbursementOfficerAction.bind(null, claim.id)}
              className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <input
                name="note"
                placeholder="Optional HOT note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Forward to A/O Reimbursement Officer
              </button>
            </form>
          ) : null}
          {availablePostIntakeTransitions.map((transition) => (
            <form
              key={`${transition.from}:${transition.to}`}
              action={forwardClaimAlongWorkflowAction.bind(
                null,
                claim.id,
                transition.from,
                transition.to,
              )}
              className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <input
                name="note"
                placeholder={`Optional ${transition.from.replaceAll("_", " ")} note`}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Forward to {transition.to.replaceAll("_", " ")}
              </button>
            </form>
          ))}
          {canMarkKiv ? (
            <form
              action={markClaimKivAction.bind(null, claim.id)}
              className="mt-5 grid gap-3 border-t border-[#800020]/10 pt-5 md:grid-cols-[1fr_auto]"
            >
              <input
                name="note"
                placeholder="Optional DG KIV note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
              <button className="min-h-10 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white">
                Mark KIV / pause claim
              </button>
            </form>
          ) : null}
          {canResumeKiv ? (
            <form
              action={resumeClaimFromKivAction.bind(null, claim.id)}
              className="mt-5 grid gap-3 border-t border-[#800020]/10 pt-5 md:grid-cols-[1fr_auto]"
            >
              <input
                name="note"
                placeholder="Optional DG resume note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Resume claim at current desk
              </button>
            </form>
          ) : null}
        </section>
        </CollapsibleClaimSection>
      ) : null}

      {!isItfRole(activeRole) ? <CollapsibleClaimSection title="Attached approved trainings">
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Attached approved trainings</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          These approved and monitored trainings form the evidence base for this reimbursement
          claim.
        </p>
        <div className="mt-4 grid gap-3">
          {claim.trainingRequests.map(({ trainingRequest }) => (
            <div
              key={trainingRequest.id}
              className="flex flex-col gap-3 rounded-md border border-zinc-100 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={`/training-requests/${trainingRequest.id}?claimId=${claim.id}`}
                  className="text-sm font-semibold text-[#800020]"
                >
                  {trainingRequest.title}
                </Link>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {trainingRequest.approvalReference ?? "Approval reference pending"} ·{" "}
                  {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                    trainingRequest.startsAt,
                  )}{" "}
                  · {formatMoney(trainingRequest.estimatedCost)}
                </p>
              </div>
              {canManageClaimTrainings && claim.trainingRequests.length > 1 ? (
                <form
                  action={detachTrainingFromClaimAction.bind(
                    null,
                    claim.id,
                    trainingRequest.id,
                  )}
                >
                  <button className="min-h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700">
                    Remove from claim
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>

        {canManageClaimTrainings && availableTrainings.length > 0 ? (
          <form
            action={attachTrainingsToClaimAction.bind(null, claim.id)}
            className="mt-5 border-t border-zinc-100 pt-5"
          >
            <h3 className="text-sm font-semibold text-zinc-950">
              Add other available trainings
            </h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {availableTrainings.map((training) => (
                <label
                  key={training.id}
                  className="flex cursor-pointer gap-3 rounded-md border border-zinc-100 p-3"
                >
                  <input
                    type="checkbox"
                    name="trainingRequestIds"
                    value={training.id}
                    className="mt-1 size-4 accent-[#800020]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-zinc-950">
                      {training.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      {training.approvalReference ?? "Approval reference pending"} ·{" "}
                      {formatMoney(training.estimatedCost)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Attach selected trainings
            </button>
          </form>
        ) : null}
      </section>
      </CollapsibleClaimSection> : null}

      <CollapsibleClaimSection title="Contribution eligibility verification">
      <section id="contribution-verification" className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        {query.assessmentSaved ? <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">Evidence assessment saved. Annual payment eligibility must still be confirmed by the configured compliance source.</p> : null}
        {query.assessmentError ? <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-950">{query.assessmentError}</p> : null}
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Contribution eligibility verification
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Annual compliance payment for training year {claim.claimYear ?? "not set"}: <strong>{annualPaymentCheck?.status ?? "Not checked"}</strong>.
              {annualPaymentCheck ? ` ${annualPaymentCheck.message}` : ""}
              {annualPaymentCheck?.checkedAt ? ` Last checked ${formatDate(annualPaymentCheck.checkedAt)}.` : ""}
            </p>
            {query.paymentCheck ? <p className={`mt-3 rounded-md px-4 py-3 text-sm font-bold ${query.paymentCheck === "ELIGIBLE" ? "border border-emerald-300 bg-emerald-50 text-emerald-950" : query.paymentCheck === "INELIGIBLE" ? "border border-red-300 bg-red-50 text-red-950" : "border border-amber-300 bg-amber-50 text-amber-950"}`}>Payment recheck result: {query.paymentCheck}.</p> : null}
            {query.paymentCheckError ? <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-950">Payment recheck failed: {query.paymentCheckError}</p> : null}
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The annual payment check above uses the configured compliance source. The form below
              records a reviewer&apos;s assessment of supporting payment evidence; it cannot replace
              the annual eligibility check or bypass the claim-processing gate.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
            {formatContributionVerificationStatus(claim.contributionVerificationStatus)}
          </span>
        </div>

        {session?.user?.email && isItfRole(activeRole) ? (
          <form action={recheckClaimAnnualPaymentAction.bind(null, claim.id)} className="mt-4">
            <button className="min-h-10 rounded-md border border-[#800020] px-4 text-sm font-semibold text-[#800020]">
              Recheck annual payment
            </button>
          </form>
        ) : null}

        <div className="mt-5 grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-2">
          <p>Source: {formatContributionVerificationSource(claim.contributionVerificationSource)}</p>
          <p>Verified by: {claim.contributionVerifiedBy?.name ?? "Not recorded"}</p>
          <p>Verified at: {formatDate(claim.contributionVerifiedAt)}</p>
          <p>Receipt/reference: {claim.itfReceiptNumber ?? "Not provided"}</p>
          <p>Contribution paid: {formatMoney(claim.trainingContributionPaid)}</p>
          <p>
            External provider: {claim.externalVerificationProvider ?? "Not connected"}
          </p>
          <p>
            External reference: {claim.externalVerificationReference ?? "Not provided"}
          </p>
          <p>
            External checked at: {formatDate(claim.externalVerificationCheckedAt)}
          </p>
          <p className="md:col-span-2">
            Verification note: {claim.contributionVerificationNote ?? "No note recorded"}
          </p>
          {claim.externalVerificationMessage ? (
            <p className="md:col-span-2">
              External message: {claim.externalVerificationMessage}
            </p>
          ) : null}
        </div>

        {canRecommendClaim ? (
          <form
            action={updateClaimContributionVerificationAction.bind(null, claim.id)}
            className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <h3 className="font-semibold text-zinc-950">Reviewer evidence assessment</h3>
              <p className="mt-1 text-sm text-zinc-600">Manual review documents what the officer found. A manual Verified selection does not make an API-pending or ineligible company eligible.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-zinc-700">Evidence assessment status<select
              name="contributionVerificationStatus"
              defaultValue={claim.contributionVerificationStatus}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {contributionVerificationStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatContributionVerificationStatus(status)}
                </option>
              ))}
            </select></label>
            <label className="grid gap-1 text-sm font-medium text-zinc-700">Assessment source<select
              name="contributionVerificationSource"
              defaultValue={claim.contributionVerificationSource}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {contributionVerificationSources.map((source) => (
                <option key={source} value={source}>
                  {formatContributionVerificationSource(source)}
                </option>
              ))}
            </select></label>
            <label className="grid gap-1 text-sm font-medium text-zinc-700">External provider<input
              name="externalVerificationProvider"
              defaultValue={claim.externalVerificationProvider ?? ""}
              placeholder="External provider e.g. Compliance API"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm font-medium text-zinc-700">External verification reference<input
              name="externalVerificationReference"
              defaultValue={claim.externalVerificationReference ?? ""}
              placeholder="External verification reference"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm font-medium text-zinc-700">External verification message<input
              name="externalVerificationMessage"
              defaultValue={claim.externalVerificationMessage ?? ""}
              placeholder="External verification message"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm font-medium text-zinc-700 md:col-span-2">Reviewer note<textarea
              name="contributionVerificationNote"
              defaultValue={claim.contributionVerificationNote ?? ""}
              placeholder="Verification note"
              className="min-h-24 rounded-md border border-zinc-200 px-3 py-2 text-sm"
            /></label>
            <div className="md:col-span-2">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Save evidence assessment
              </button>
            </div>
          </form>
        ) : null}
      </section>
      </CollapsibleClaimSection>

      <CollapsibleClaimSection title="Claim staff entries">
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Claim staff entries</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Enter Staff/Employee IDs used for Management, Supervisory, and Occupational claim
          counts. Use one staff member per line. Add an optional name after a comma, for example:
          <span className="ml-1 font-mono text-xs">EMP-001, Ada Lovelace</span>.
        </p>

        {duplicateStaffEntries.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Duplicate Staff/Employee IDs detected</p>
            <p className="mt-1">
              These entries are flagged for ITF review/removal because a staff member should appear
              in only one of Management, Supervisory, or Occupational.
            </p>
            <div className="mt-3 grid gap-2">
              {Object.entries(
                duplicateStaffEntries.reduce<Record<string, typeof duplicateStaffEntries>>(
                  (groups, entry) => {
                    const key = entry.duplicateGroupKey ?? "UNKNOWN";
                    groups[key] = [...(groups[key] ?? []), entry];
                    return groups;
                  },
                  {},
                ),
              ).map(([groupKey, entries]) => (
                <div key={groupKey} className="rounded-md bg-white px-3 py-2 ring-1 ring-amber-100">
                  <p className="font-mono text-xs font-semibold">{groupKey}</p>
                  <p className="mt-1 text-xs">
                    {entries
                      .map(
                        (entry) =>
                          `${entry.employeeId} · ${formatStaffArea(entry.trainingArea)}${
                            entry.employeeName ? ` · ${entry.employeeName}` : ""
                          }`,
                      )
                      .join(" | ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : claim.staffEntries.length > 0 ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            No duplicate Staff/Employee IDs detected.
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {Object.entries(staffEntriesByArea).map(([area, entries]) => (
            <div key={area} className="rounded-lg border border-zinc-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-zinc-950">{formatStaffArea(area)}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                  {entries.length}
                </span>
              </div>
              {entries.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No staff entries yet.</p>
              ) : (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-md bg-zinc-50 p-2">
                  {entries.map((entry) => (
                    <p
                      key={entry.id}
                      className={`text-xs leading-5 ${
                        entry.duplicateGroupKey ? "font-semibold text-amber-800" : "text-zinc-600"
                      }`}
                    >
                      {entry.employeeId}
                      {entry.employeeName ? ` · ${entry.employeeName}` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {canSubmitClaim && claim.status === "DRAFT" ? (
          <form
            action={updateClaimStaffEntriesAction.bind(null, claim.id)}
            className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 md:grid-cols-3"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Management staff
              <textarea
                name="managementStaff"
                rows={8}
                defaultValue={staffEntriesByArea.MANAGEMENT
                  .map((entry) =>
                    entry.employeeName ? `${entry.employeeId}, ${entry.employeeName}` : entry.employeeId,
                  )
                  .join("\n")}
                className="rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Supervisory staff
              <textarea
                name="supervisoryStaff"
                rows={8}
                defaultValue={staffEntriesByArea.SUPERVISORY
                  .map((entry) =>
                    entry.employeeName ? `${entry.employeeId}, ${entry.employeeName}` : entry.employeeId,
                  )
                  .join("\n")}
                className="rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Occupational staff
              <textarea
                name="occupationalStaff"
                rows={8}
                defaultValue={staffEntriesByArea.OCCUPATIONAL
                  .map((entry) =>
                    entry.employeeName ? `${entry.employeeId}, ${entry.employeeName}` : entry.employeeId,
                  )
                  .join("\n")}
                className="rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
              />
            </label>
            <div className="md:col-span-3">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Save staff entries
              </button>
            </div>
          </form>
        ) : null}
      </section>
      </CollapsibleClaimSection>

      <CollapsibleClaimSection title="Form 2A/2B calculations">
      <section id="calculations" className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Form 2A/2B calculations</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {canEditCalculations
            ? "Enter the employer claim schedule and use Calculate to estimate the claim. Calculated rows are read-only; Save row updates only a manually added adjustment row."
            : "The employer claim calculation is read-only here. ITF staff review the submitted figures but do not change the employer schedule or create adjustment rows."}
          {" "}These figures are not an ITF approval.
        </p>
        {query.lineSaved ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Manual calculation row saved.</p> : null}
        {query.lineError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{query.lineError}</p> : null}
        {claim.lines.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            No calculation row has been added to this claim yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {claim.lines.map((line) => {
              const rowArea = trainingAreaForCalculationRow(line.awardArea, line.trainingArea);
              const linkedTrainings = rowArea ? claim.trainingRequests.filter(({ trainingRequest }) =>
                trainingRequest.participants.some(({ trainingArea }) =>
                  trainingArea && (rowArea === "all" || trainingArea.trim().toLowerCase() === rowArea),
                ),
              ) : [];
              return <div key={line.id} className="rounded-md border border-zinc-100 p-3">
                {line.awardArea || !canEditCalculations ? <div className="mt-3 grid gap-2 text-sm text-zinc-700 md:grid-cols-4">
                  <p><strong>Training area:</strong> {line.trainingArea}</p>
                  <p><strong>Total workforce:</strong> {line.totalWorkforce ?? "Not provided"}</p>
                  <p><strong>Total trained:</strong> {line.totalTrained ?? "Not provided"}</p>
                  <p><strong>Emphasis:</strong> {line.emphasisNumber ?? "Not provided"}</p>
                  <p><strong>Contribution paid:</strong> {formatMoney(line.contributionPaid)}</p>
                  <p><strong>Employer claim estimate:</strong> {formatMoney(line.employerClaimAmount)}</p>
                  <p><strong>Indicative reimbursement rate:</strong> {line.percentAwarded === null ? "Not calculated" : `${decimalInput(line.percentAwarded)}%`}</p>
                  {!line.awardArea && line.amountAwarded ? <p><strong>Indicative amount:</strong> {formatMoney(line.amountAwarded)}</p> : null}
                  <p><strong>ITF-approved reimbursement:</strong> {approvedReimbursementStatus}</p>
                </div> : <form
                  action={updateClaimLineAction.bind(null, claim.id, line.id)}
                  className="grid gap-3 md:grid-cols-4"
                >
                  <div className="md:col-span-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-2 py-1">
                      {line.stage.replaceAll("_", " ")}
                    </span>
                  </div>
                  <label className="grid gap-1 text-sm">Training area<input
                    name="trainingArea"
                    defaultValue={line.trainingArea}
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Total workforce<input
                    name="totalWorkforce"
                    type="number"
                    defaultValue={line.totalWorkforce ?? ""}
                    placeholder="Workforce"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Total trained<input
                    name="totalTrained"
                    type="number"
                    defaultValue={line.totalTrained ?? ""}
                    placeholder="Trained"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Emphasis number<input
                    name="emphasisNumber"
                    type="number"
                    defaultValue={line.emphasisNumber ?? ""}
                    placeholder="Emphasis"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Contribution paid<input
                    name="contributionPaid"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.contributionPaid)}
                    placeholder="Contribution paid"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Employer claim amount<input
                    name="employerClaimAmount"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.employerClaimAmount)}
                    placeholder="Employer claim"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Indicative reimbursement rate<input
                    name="percentAwarded"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.percentAwarded)}
                    placeholder="Indicative rate %"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Indicative amount (not approved)<input
                    name="amountAwarded"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.amountAwarded)}
                    placeholder="Indicative amount"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm">Reference page<input
                    name="referencePage"
                    defaultValue={line.referencePage ?? ""}
                    placeholder="Reference page"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  <label className="grid gap-1 text-sm md:col-span-2">Remarks<input
                    name="remarks"
                    defaultValue={line.remarks ?? ""}
                    placeholder="Remarks"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  /></label>
                  {canEditCalculations ? (
                    <button className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm font-semibold">
                      Save row
                    </button>
                  ) : null}
                </form>}
                {canEditCalculations && !line.awardArea ? (
                  <form
                    action={deleteClaimLineAction.bind(null, claim.id, line.id)}
                    className="mt-2"
                  >
                    <button className="min-h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700">
                      Delete row
                    </button>
                  </form>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  Trained percentage: {decimalInput(line.percentTrained) || "Not calculated"}
                </p>
                {linkedTrainings.length > 0 ? (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <p className="text-xs font-semibold text-zinc-700">Attached approved trainings in this area</p>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {linkedTrainings.map(({ trainingRequest }) => (
                        <li key={trainingRequest.id}>
                          <Link href={`/training-requests/${trainingRequest.id}?claimId=${claim.id}`} className="font-semibold text-[#800020] underline-offset-2 hover:underline">
                            {trainingRequest.title}
                          </Link>
                          <span className="ml-2 text-xs text-zinc-500">{trainingRequest.approvalReference ?? "Approval reference pending"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>;
            })}
          </div>
        )}

        {isItfRole(activeRole) && unmatchedTrainings.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-sm font-semibold text-amber-950">Attached trainings without a matching calculation area</h3>
            <p className="mt-1 text-xs text-amber-900">These requests remain accessible here because their participants have no matching training area on the current calculation rows.</p>
            <ul className="mt-2 grid gap-2 text-sm">
              {unmatchedTrainings.map(({ trainingRequest }) => (
                <li key={trainingRequest.id}>
                  <Link href={`/training-requests/${trainingRequest.id}?claimId=${claim.id}`} className="font-semibold text-[#800020] underline-offset-2 hover:underline">
                    {trainingRequest.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canEditCalculations ? (
          <div className="mt-5 grid gap-5 border-t border-zinc-100 pt-5">
            <form
              action={updateEmployerClaimCalculationAction.bind(null, claim.id)}
              className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <input type="hidden" name="employerScale" value="MEDIUM_LARGE" />
              <h3 className="font-semibold text-zinc-950">Medium/Large employer schedule</h3>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="grid gap-1 text-sm">Training contribution paid<input
                  name="trainingContributionPaid"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={decimalInput(claim.trainingContributionPaid)}
                  placeholder="Contribution paid"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                /></label>
                {[
                  ["management", "Management"],
                  ["supervisory", "Supervisory"],
                  ["occupational", "Occupational"],
                ].map(([key, label]) => (
                  <div key={key} className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
                    <p className="text-sm font-semibold text-zinc-900">{label}</p>
                    <label className="grid gap-1 text-sm">Total staff<input
                      name={`${key}TotalStaff`}
                      type="number"
                      min="0"
                      required
                      placeholder="Total staff"
                      className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                    /></label>
                    <label className="grid gap-1 text-sm">Staff trained<input
                      name={`${key}TotalTrained`}
                      type="number"
                      min="0"
                      required
                      placeholder="Trained"
                      className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                    /></label>
                    <label className="grid gap-1 text-sm">Emphasis rank<select
                      name={`${key}EmphasisRank`}
                      required
                      className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                    >
                      <option value="">Emphasis rank</option>
                      <option value="1">1st emphasis</option>
                      <option value="2">2nd emphasis</option>
                      <option value="3">3rd emphasis</option>
                    </select></label>
                  </div>
                ))}
                <div className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
                  <p className="text-sm font-semibold text-zinc-900">L&D Personnel</p>
                  <label className="grid gap-1 text-sm">Total L&D staff<input name="ldTotalStaff" type="number" min="0" placeholder="Total L&D staff" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
                  <label className="grid gap-1 text-sm">L&D staff trained<input name="ldTotalTrained" type="number" min="0" placeholder="L&D trained" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
                </div>
                <div className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
                  <p className="text-sm font-semibold text-zinc-900">HSE</p>
                  <label className="grid gap-1 text-sm">Total workforce<input name="hseTotalWorkforce" type="number" min="0" placeholder="Total workforce" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
                  <label className="grid gap-1 text-sm">HSE staff trained<input name="hseTotalTrained" type="number" min="0" placeholder="HSE trained" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
                </div>
                <label className="grid gap-1 text-sm">SIWES students accepted<input name="siwesStudentsAccepted" type="number" min="0" placeholder="SIWES students" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" /></label>
                <label className="flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium ring-1 ring-zinc-200">
                  <input name="trainingPlanSubmittedPromptly" type="checkbox" className="size-4 accent-[#800020]" />
                  Training plan submitted by 31 March
                </label>
              </div>
              <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Calculate Medium/Large claim
              </button>
            </form>

            <form
              action={updateEmployerClaimCalculationAction.bind(null, claim.id)}
              className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <input type="hidden" name="employerScale" value="SMALL" />
              <h3 className="font-semibold text-zinc-950">Small Scale employer schedule</h3>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="grid gap-1 text-sm">Training contribution paid<input name="trainingContributionPaid" type="number" step="0.01" required defaultValue={decimalInput(claim.trainingContributionPaid)} placeholder="Contribution paid" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" /></label>
                <label className="grid gap-1 text-sm">Total staff<input name="smallTotalStaff" type="number" min="0" required placeholder="Total staff" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" /></label>
                <label className="grid gap-1 text-sm">Total staff trained<input name="smallTotalTrained" type="number" min="0" required placeholder="Total trained" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" /></label>
                <label className="grid gap-1 text-sm">SIWES students accepted<input name="siwesStudentsAccepted" type="number" min="0" placeholder="SIWES students" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" /></label>
                <label className="flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium ring-1 ring-zinc-200">
                  <input name="trainingPlanSubmittedPromptly" type="checkbox" className="size-4 accent-[#800020]" />
                  Training plan submitted by 31 March
                </label>
              </div>
              <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Calculate Small Scale claim
              </button>
            </form>

            <form
              action={addClaimLineAction.bind(null, claim.id)}
              className="grid gap-3 rounded-lg border border-dashed border-zinc-300 p-4 md:grid-cols-4"
            >
              <p className="text-sm font-semibold text-zinc-950 md:col-span-4">
                Manual adjustment row
              </p>
              <label className="grid gap-1 text-sm">Training area<input name="trainingArea" required placeholder="Training area" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-sm">Total workforce<input name="totalWorkforce" type="number" placeholder="Workforce" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-sm">Total trained<input name="totalTrained" type="number" placeholder="Trained" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-sm">Employer claim amount<input name="employerClaimAmount" type="number" step="0.01" placeholder="Employer claim" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" /></label>
              <button className="min-h-10 rounded-md border border-zinc-200 px-4 text-sm font-semibold text-zinc-800">
                Add manual row
              </button>
            </form>
          </div>
        ) : null}
      </section>
      </CollapsibleClaimSection>

      <CollapsibleClaimSection title="Employer claim details">
      <section id="claim-form" className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Employer claim details</h2>
        {query.formSaved ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Claim form saved.</p> : null}
        {query.formError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{query.formError}</p> : null}
        {canSubmitClaim ? (
          <form
            action={updateClaimFormAction.bind(null, claim.id)}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <label className="grid gap-1 text-sm">Claim year<input
              name="claimYear"
              type="number"
              defaultValue={claim.claimYear ?? ""}
              placeholder="Claim year"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm">Claimed amount<input
              name="claimedAmount"
              type="number"
              step="0.01"
              required
              defaultValue={decimalInput(claim.claimedAmount)}
              placeholder="Claimed amount"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm">Training contribution due<input
              name="trainingContributionDue"
              type="number"
              step="0.01"
              defaultValue={decimalInput(claim.trainingContributionDue)}
              placeholder="Training contribution due"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm">Training contribution paid<input
              name="trainingContributionPaid"
              type="number"
              step="0.01"
              defaultValue={decimalInput(claim.trainingContributionPaid)}
              placeholder="Training contribution paid"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm">ITF receipt number<input
              name="itfReceiptNumber"
              defaultValue={claim.itfReceiptNumber ?? ""}
              placeholder="ITF receipt number"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <ClaimBankFields banks={bankOptions} currentBankName={claim.bankName} currentSortCode={claim.sortCode} currentAccountNumber={claim.accountNumber} />
            <label className="grid gap-1 text-sm">Employer officer name<input
              name="employerOfficerName"
              defaultValue={claim.employerOfficerName ?? ""}
              placeholder="Employer officer name"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm">Employer officer rank<input
              name="employerOfficerRank"
              defaultValue={claim.employerOfficerRank ?? ""}
              placeholder="Employer officer rank"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <label className="grid gap-1 text-sm">Chief executive name<input
              name="chiefExecutiveName"
              defaultValue={claim.chiefExecutiveName ?? ""}
              placeholder="Chief executive name"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            /></label>
            <div className="md:col-span-2">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Save Claim Form 1
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-2">
            <p>Claim year: {claim.claimYear ?? "Not provided"}</p>
            <p>Claimed amount: {formatMoney(claim.claimedAmount)}</p>
            <p>Contribution due: {formatMoney(claim.trainingContributionDue)}</p>
            <p>Contribution paid: {formatMoney(claim.trainingContributionPaid)}</p>
            <p>Receipt: {claim.itfReceiptNumber ?? "Not provided"}</p>
            <p>Bank: {claim.bankName ?? "Not provided"}</p>
            <p>Account: {claim.accountNumber ?? "Not provided"}</p>
            <p>Sort code: {claim.sortCode ?? "Not provided"}</p>
          </div>
        )}
      </section>
      </CollapsibleClaimSection>

      <CollapsibleClaimSection title="Supporting evidence">
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Supporting evidence</h2>
        {claim.documents.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            No supporting evidence has been uploaded for this claim yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {claim.documents.map((document) => (
              <div key={document.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                <p className="font-semibold text-zinc-950">{document.fileName}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {document.kind.replaceAll("_", " ")} ·{" "}
                  {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                    document.createdAt,
                  )}
                </p>
                <Link
                  href={`/registry/${claim.company.id}/evidence/${document.id}?disposition=inline`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800"
                >
                  View evidence
                </Link>
              </div>
            ))}
          </div>
        )}

        {canUploadClaimEvidence ? (
          <form
            action={uploadClaimEvidenceAction.bind(null, claim.id)}
            className="mt-5 grid gap-3 border-t border-zinc-100 pt-5 md:grid-cols-[240px_1fr_auto]"
          >
            <select
              name="kind"
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {evidenceKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
              name="evidence"
              accept=".pdf,.jpg,.jpeg,.png,.csv"
              required
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Upload evidence
            </button>
          </form>
        ) : null}
      </section>
      </CollapsibleClaimSection>

      {canViewAuditReview ? (
        <CollapsibleClaimSection title="Audit review">
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Audit review</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Foundation for the Reimbursement Schedule Auditor&apos;s audit work. Detailed
                checklist fields can be added here once the official audit procedure is provided.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
              {claim.auditReview
                ? formatReimbursementAuditReviewStatus(claim.auditReview.status)
                : "Not started"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-2">
            <p>Audited amount: {formatMoney(claim.auditReview?.auditedAmount ?? null)}</p>
            <p>Variance amount: {formatMoney(claim.auditReview?.varianceAmount ?? null)}</p>
            <p>Prepared by: {claim.auditReview?.preparedBy?.name ?? "Not recorded"}</p>
            <p>Prepared at: {formatDate(claim.auditReview?.preparedAt ?? null)}</p>
            <p>Verified by: {claim.auditReview?.verifiedBy?.name ?? "Not recorded"}</p>
            <p>Verified at: {formatDate(claim.auditReview?.verifiedAt ?? null)}</p>
            <p className="md:col-span-2">
              Recommendation: {claim.auditReview?.recommendation ?? "No recommendation recorded"}
            </p>
            <p className="md:col-span-2">
              Observations: {claim.auditReview?.observations ?? "No observations recorded"}
            </p>
          </div>

          {canUpdateAuditReview ? (
            <form
              action={updateClaimAuditReviewAction.bind(null, claim.id)}
              className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 md:grid-cols-2"
            >
              <select
                name="auditReviewStatus"
                defaultValue={claim.auditReview?.status ?? "DRAFT"}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                {reimbursementAuditReviewStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatReimbursementAuditReviewStatus(status)}
                  </option>
                ))}
              </select>
              <input
                name="auditedAmount"
                type="number"
                step="0.01"
                defaultValue={decimalInput(claim.auditReview?.auditedAmount ?? null)}
                placeholder="Audited amount"
                className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
              />
              <input
                name="varianceAmount"
                type="number"
                step="0.01"
                defaultValue={decimalInput(claim.auditReview?.varianceAmount ?? null)}
                placeholder="Variance amount"
                className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
              />
              <input
                name="auditRecommendation"
                defaultValue={claim.auditReview?.recommendation ?? ""}
                placeholder="Audit recommendation"
                className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
              />
              <textarea
                name="auditObservations"
                defaultValue={claim.auditReview?.observations ?? ""}
                placeholder="Audit observations"
                className="min-h-24 rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
              />
              <div className="md:col-span-2">
                <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Save audit review
                </button>
              </div>
            </form>
          ) : null}
        </section>
        </CollapsibleClaimSection>
      ) : null}

      <CollapsibleClaimSection title="Payment handoff">
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Payment handoff</h2>
            {isItfRole(activeRole) ? <p className="mt-2 text-sm leading-6 text-zinc-600">
              Interim bridge to ITF&apos;s existing payment process. Until ERP/API details are
              available, the e-payment schedule can be downloaded and manually fed into the
              payment system.
            </p> : null}
          </div>
          {canRecommendClaim ? (
            <Link
              href={`/claims/${claim.id}/payment-schedule`}
              className="inline-flex min-h-10 w-fit items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
            >
              Download e-payment schedule CSV
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-2">
          <p>
            Handoff status:{" "}
            {formatReimbursementPaymentHandoffStatus(claim.paymentHandoffStatus)}
          </p>
          <p>
            Schedule reference:{" "}
            {claim.paymentScheduleReference ?? "Generated at download until formally exported"}
          </p>
          <p>Recommended amount: {formatMoney(claim.claimRecommendedAmount)}</p>
          <p>Bank: {claim.bankName ?? "Not provided"}</p>
          <p>Account number: {claim.accountNumber ?? "Not provided"}</p>
          <p>Sort code: {claim.sortCode ?? "Not provided"}</p>
          <p>Schedule exported at: {formatDate(claim.paymentScheduleExportedAt)}</p>
          <p>Payment system reference: {claim.paymentSystemReference ?? "Not recorded"}</p>
          <p>Payment system status: {claim.paymentSystemStatus ?? "Not synced"}</p>
          <p>Payment system synced at: {formatDate(claim.paymentSystemSyncedAt)}</p>
          <p>Paid at: {formatDate(claim.paidAt)}</p>
        </div>

        {canUpdatePaymentHandoff ? (
          <form
            action={updateClaimPaymentHandoffAction.bind(null, claim.id)}
            className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 md:grid-cols-2"
          >
            <select
              name="paymentHandoffStatus"
              defaultValue={claim.paymentHandoffStatus}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {reimbursementPaymentHandoffStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatReimbursementPaymentHandoffStatus(status)}
                </option>
              ))}
            </select>
            <input
              name="paymentSystemReference"
              defaultValue={claim.paymentSystemReference ?? ""}
              placeholder="Payment system / PV reference"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="paymentSystemStatus"
              defaultValue={claim.paymentSystemStatus ?? ""}
              placeholder="Payment system status"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="note"
              placeholder="Optional payment handoff note"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <div className="md:col-span-2">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Update payment handoff
              </button>
            </div>
          </form>
        ) : null}
      </section>
      </CollapsibleClaimSection>

      <CollapsibleClaimSection title="Claim decision trail">
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Claim decision trail</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Chronological record of claim routing, recommendations, KIV pauses/resumptions,
              payment updates, and settlement decisions for this employer.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
            {claim.decisions.length} recent decision{claim.decisions.length === 1 ? "" : "s"}
          </span>
        </div>

        {claim.decisions.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            No decision trail has been recorded for this claim yet.
          </p>
        ) : (
          <ol className="mt-5 space-y-4">
            {claim.decisions.map((decision) => (
              <li
                key={decision.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.12em] text-[#800020]">
                      {formatDecisionAction(decision.action)}
                    </p>
                    <p className="mt-1 font-semibold text-zinc-950">
                      {decision.actor.name}
                    </p>
                    <p className="text-xs text-zinc-500">{decision.actor.email}</p>
                  </div>
                  <time className="text-xs font-semibold text-zinc-500">
                    {formatDate(decision.createdAt)}
                  </time>
                </div>
                <p className="mt-3 leading-6 text-zinc-700">
                  {decision.reason ?? "No reason or note recorded."}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      </CollapsibleClaimSection>

      {canRecommendClaim ? (
        <CollapsibleClaimSection title="Form 1B recommendation">
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Form 1B recommendation</h2>
          <form
            action={updateClaimRecommendationAction.bind(null, claim.id)}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <input
              name="eligibleAmount"
              type="number"
              step="0.01"
              defaultValue={decimalInput(claim.eligibleAmount)}
              placeholder="Eligible amount"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="claimRecommendedAmount"
              type="number"
              step="0.01"
              defaultValue={decimalInput(claim.claimRecommendedAmount)}
              placeholder="Recommended amount"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="claimRecommendedInWords"
              defaultValue={claim.claimRecommendedInWords ?? ""}
              placeholder="Recommended amount in words"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="reviewerRemarks"
              defaultValue={claim.paymentDetails ?? ""}
              placeholder="Reviewer remarks"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <div className="md:col-span-2">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Save Form 1B recommendation
              </button>
            </div>
          </form>
        </section>
        </CollapsibleClaimSection>
      ) : null}
    </div>
  );
}
