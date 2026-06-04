import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  addClaimLineAction,
  deleteClaimLineAction,
  updateClaimLineAction,
  updateClaimRecommendationAction,
  updateClaimFormAction,
  uploadClaimEvidenceAction,
} from "@/app/(dashboard)/claims/[claimId]/actions";
import { authOptions } from "@/lib/auth";
import { getClaimEvidenceKinds } from "@/lib/claims";
import { getDb } from "@/lib/db";
import { canUseSection } from "@/lib/feature-gates";

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
      trainingContributionDue: true,
      trainingContributionPaid: true,
      itfReceiptNumber: true,
      bankName: true,
      accountNumber: true,
      sortCode: true,
      claimedAmount: true,
      eligibleAmount: true,
      claimRecommendedAmount: true,
      claimRecommendedInWords: true,
      paymentDetails: true,
      employerOfficerName: true,
      employerOfficerRank: true,
      chiefExecutiveName: true,
      employerDeclaredAt: true,
      status: true,
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
      trainingRequest: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!claim) {
    notFound();
  }

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
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Form 2A/2B calculations</h2>
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
          <form
            action={addClaimLineAction.bind(null, claim.id)}
            className="mt-5 grid gap-3 border-t border-zinc-100 pt-5 md:grid-cols-4"
          >
            <input
              name="trainingArea"
              required
              placeholder="Training area"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="totalWorkforce"
              type="number"
              placeholder="Workforce"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="totalTrained"
              type="number"
              placeholder="Trained"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <input
              name="employerClaimAmount"
              type="number"
              step="0.01"
              placeholder="Employer claim"
              className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
            />
            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Add calculation row
            </button>
          </form>
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
