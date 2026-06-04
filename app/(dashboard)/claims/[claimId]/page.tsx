import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  updateClaimRecommendationAction,
  updateClaimFormAction,
  uploadClaimEvidenceAction,
} from "@/app/(dashboard)/claims/[claimId]/actions";
import { authOptions } from "@/lib/auth";
import { getClaimEvidenceKinds } from "@/lib/claims";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";

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
  const canRecommendClaim = can(activeRole, "claims:review");
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
        <h2 className="text-xl font-semibold tracking-tight">Employer claim details</h2>
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
