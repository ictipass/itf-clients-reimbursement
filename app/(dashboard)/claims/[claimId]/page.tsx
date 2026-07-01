import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  addClaimLineAction,
  attachTrainingsToClaimAction,
  deleteClaimLineAction,
  detachTrainingFromClaimAction,
  forwardClaimToAreaReimbursementOfficerAction,
  forwardClaimToHeadOfTrainingAction,
  submitClaimToAreaManagerAction,
  updateClaimStaffEntriesAction,
  updateClaimLineAction,
  updateEmployerClaimCalculationAction,
  updateClaimContributionVerificationAction,
  updateClaimRecommendationAction,
  updateClaimFormAction,
  uploadClaimEvidenceAction,
} from "@/app/(dashboard)/claims/[claimId]/actions";
import { authOptions } from "@/lib/auth";
import {
  contributionVerificationSources,
  contributionVerificationStatuses,
  formatContributionVerificationSource,
  formatContributionVerificationStatus,
} from "@/lib/claim-verification";
import { CLAIM_SUBMISSION_DEADLINE_NOTICE } from "@/lib/claim-policy";
import { getClaimEvidenceKinds } from "@/lib/claims";
import { getDb } from "@/lib/db";
import { canUseSection } from "@/lib/feature-gates";
import { formatReimbursementPaymentHandoffStatus } from "@/lib/reimbursement-payment-schedule";
import { formatReimbursementPolicyEdition } from "@/lib/reimbursement-policy";

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

function formatDate(value: Date | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
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

export default async function ClaimDetailPage({
  params,
}: Readonly<{
  params: Promise<{ claimId: string }>;
}>) {
  const { claimId } = await params;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const canSubmitClaim = canUseSection(activeRole, "claim.form.edit");
  const canRecommendClaim = canUseSection(activeRole, "claim.recommendation.edit");
  const canUploadClaimEvidence = canUseSection(activeRole, "claim.evidence.upload");
  const canEditCalculations = canUseSection(activeRole, "claim.calculation.edit");
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
  const staffEntriesByArea = {
    MANAGEMENT: claim.staffEntries.filter((entry) => entry.trainingArea === "MANAGEMENT"),
    SUPERVISORY: claim.staffEntries.filter((entry) => entry.trainingArea === "SUPERVISORY"),
    OCCUPATIONAL: claim.staffEntries.filter((entry) => entry.trainingArea === "OCCUPATIONAL"),
  };
  const duplicateStaffEntries = claim.staffEntries.filter((entry) => entry.duplicateGroupKey);
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
            Award %
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
            Calculated award
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

      {(canSubmitToAreaManager ||
        canForwardToHot ||
        canForwardToAreaReimbursementOfficer) ? (
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
        </section>
      ) : null}

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
                  href={`/training-requests/${trainingRequest.id}`}
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

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Contribution eligibility verification
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Confirms that the employer&apos;s contribution/payment evidence is genuine enough to
              support this reimbursement claim. This can later be backed by an external compliance
              verification API.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
            {formatContributionVerificationStatus(claim.contributionVerificationStatus)}
          </span>
        </div>

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
            <select
              name="contributionVerificationStatus"
              defaultValue={claim.contributionVerificationStatus}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {contributionVerificationStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatContributionVerificationStatus(status)}
                </option>
              ))}
            </select>
            <select
              name="contributionVerificationSource"
              defaultValue={claim.contributionVerificationSource}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {contributionVerificationSources.map((source) => (
                <option key={source} value={source}>
                  {formatContributionVerificationSource(source)}
                </option>
              ))}
            </select>
            <input
              name="externalVerificationProvider"
              defaultValue={claim.externalVerificationProvider ?? ""}
              placeholder="External provider e.g. Compliance API"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="externalVerificationReference"
              defaultValue={claim.externalVerificationReference ?? ""}
              placeholder="External verification reference"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="externalVerificationMessage"
              defaultValue={claim.externalVerificationMessage ?? ""}
              placeholder="External verification message"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <textarea
              name="contributionVerificationNote"
              defaultValue={claim.contributionVerificationNote ?? ""}
              placeholder="Verification note"
              className="min-h-24 rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
            />
            <div className="md:col-span-2">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Save eligibility verification
              </button>
            </div>
          </form>
        ) : null}
      </section>

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

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Form 2A/2B calculations</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Enter the employer&apos;s claim schedule. The system applies the official Form 2B award
          scale and writes the calculated employer rows below.
        </p>
        {claim.lines.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            No calculation row has been added to this claim yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {claim.lines.map((line) => (
              <div key={line.id} className="rounded-md border border-zinc-100 p-3">
                <form
                  action={updateClaimLineAction.bind(null, claim.id, line.id)}
                  className="grid gap-3 md:grid-cols-4"
                >
                  <div className="md:col-span-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-2 py-1">
                      {line.stage.replaceAll("_", " ")}
                    </span>
                    {line.awardArea ? (
                      <span className="rounded-full bg-[#800020]/10 px-2 py-1 text-[#65001a]">
                        {line.awardArea.replaceAll("_", " ")}
                      </span>
                    ) : null}
                  </div>
                  <input
                    name="trainingArea"
                    defaultValue={line.trainingArea}
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="totalWorkforce"
                    type="number"
                    defaultValue={line.totalWorkforce ?? ""}
                    placeholder="Workforce"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="totalTrained"
                    type="number"
                    defaultValue={line.totalTrained ?? ""}
                    placeholder="Trained"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="emphasisNumber"
                    type="number"
                    defaultValue={line.emphasisNumber ?? ""}
                    placeholder="Emphasis"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="contributionPaid"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.contributionPaid)}
                    placeholder="Contribution paid"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="employerClaimAmount"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.employerClaimAmount)}
                    placeholder="Employer claim"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="percentAwarded"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.percentAwarded)}
                    placeholder="% awarded"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="amountAwarded"
                    type="number"
                    step="0.01"
                    defaultValue={decimalInput(line.amountAwarded)}
                    placeholder="Amount awarded"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="referencePage"
                    defaultValue={line.referencePage ?? ""}
                    placeholder="Reference page"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  />
                  <input
                    name="remarks"
                    defaultValue={line.remarks ?? ""}
                    placeholder="Remarks"
                    className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm md:col-span-2"
                  />
                  {canEditCalculations ? (
                    <button className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm font-semibold">
                      Save row
                    </button>
                  ) : null}
                </form>
                {canEditCalculations ? (
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
              </div>
            ))}
          </div>
        )}

        {canEditCalculations ? (
          <div className="mt-5 grid gap-5 border-t border-zinc-100 pt-5">
            <form
              action={updateEmployerClaimCalculationAction.bind(null, claim.id)}
              className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <input type="hidden" name="employerScale" value="MEDIUM_LARGE" />
              <h3 className="font-semibold text-zinc-950">Medium/Large employer schedule</h3>
              <div className="grid gap-3 md:grid-cols-4">
                <input
                  name="trainingContributionPaid"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={decimalInput(claim.trainingContributionPaid)}
                  placeholder="Contribution paid"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
                {[
                  ["management", "Management"],
                  ["supervisory", "Supervisory"],
                  ["occupational", "Occupational"],
                ].map(([key, label]) => (
                  <div key={key} className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
                    <p className="text-sm font-semibold text-zinc-900">{label}</p>
                    <input
                      name={`${key}TotalStaff`}
                      type="number"
                      min="0"
                      required
                      placeholder="Total staff"
                      className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                    />
                    <input
                      name={`${key}TotalTrained`}
                      type="number"
                      min="0"
                      required
                      placeholder="Trained"
                      className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                    />
                    <select
                      name={`${key}EmphasisRank`}
                      required
                      className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                    >
                      <option value="">Emphasis rank</option>
                      <option value="1">1st emphasis</option>
                      <option value="2">2nd emphasis</option>
                      <option value="3">3rd emphasis</option>
                    </select>
                  </div>
                ))}
                <div className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
                  <p className="text-sm font-semibold text-zinc-900">L&D Personnel</p>
                  <input name="ldTotalStaff" type="number" min="0" placeholder="Total L&D staff" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="ldTotalTrained" type="number" min="0" placeholder="L&D trained" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                </div>
                <div className="grid gap-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
                  <p className="text-sm font-semibold text-zinc-900">HSE</p>
                  <input name="hseTotalWorkforce" type="number" min="0" placeholder="Total workforce" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="hseTotalTrained" type="number" min="0" placeholder="HSE trained" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                </div>
                <input name="siwesStudentsAccepted" type="number" min="0" placeholder="SIWES students" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
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
                <input name="trainingContributionPaid" type="number" step="0.01" required defaultValue={decimalInput(claim.trainingContributionPaid)} placeholder="Contribution paid" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
                <input name="smallTotalStaff" type="number" min="0" required placeholder="Total staff" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
                <input name="smallTotalTrained" type="number" min="0" required placeholder="Total trained" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
                <input name="siwesStudentsAccepted" type="number" min="0" placeholder="SIWES students" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
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
              <input name="trainingArea" required placeholder="Training area" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
              <input name="totalWorkforce" type="number" placeholder="Workforce" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
              <input name="totalTrained" type="number" placeholder="Trained" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
              <input name="employerClaimAmount" type="number" step="0.01" placeholder="Employer claim" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
              <button className="min-h-10 rounded-md border border-zinc-200 px-4 text-sm font-semibold text-zinc-800">
                Add manual row
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Employer claim details</h2>
        {canSubmitClaim ? (
          <form
            action={updateClaimFormAction.bind(null, claim.id)}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <input
              name="claimYear"
              type="number"
              defaultValue={claim.claimYear ?? ""}
              placeholder="Claim year"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="claimedAmount"
              type="number"
              step="0.01"
              required
              defaultValue={decimalInput(claim.claimedAmount)}
              placeholder="Claimed amount"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="trainingContributionDue"
              type="number"
              step="0.01"
              defaultValue={decimalInput(claim.trainingContributionDue)}
              placeholder="Training contribution due"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="trainingContributionPaid"
              type="number"
              step="0.01"
              defaultValue={decimalInput(claim.trainingContributionPaid)}
              placeholder="Training contribution paid"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="itfReceiptNumber"
              defaultValue={claim.itfReceiptNumber ?? ""}
              placeholder="ITF receipt number"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="bankName"
              defaultValue={claim.bankName ?? ""}
              placeholder="Bank name"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="accountNumber"
              defaultValue={claim.accountNumber ?? ""}
              placeholder="Account number"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="sortCode"
              defaultValue={claim.sortCode ?? ""}
              placeholder="Sort code"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="employerOfficerName"
              defaultValue={claim.employerOfficerName ?? ""}
              placeholder="Employer officer name"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="employerOfficerRank"
              defaultValue={claim.employerOfficerRank ?? ""}
              placeholder="Employer officer rank"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="chiefExecutiveName"
              defaultValue={claim.chiefExecutiveName ?? ""}
              placeholder="Chief executive name"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
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
            <input
              name="evidence"
              type="file"
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

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Payment handoff</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Interim bridge to ITF&apos;s existing payment process. Until ERP/API details are
              available, the e-payment schedule can be downloaded and manually fed into the
              payment system.
            </p>
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
      </section>

      {canRecommendClaim ? (
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
      ) : null}
    </div>
  );
}
