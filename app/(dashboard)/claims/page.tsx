import Link from "next/link";

import { getDb } from "@/lib/db";

function formatMoney(value: { toString(): string } | null) {
  if (!value) {
    return "Not provided";
  }

  return `NGN ${Number(value.toString()).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ClaimsPage() {
  const claims = await getDb().reimbursementClaim.findMany({
    where: {
      recordTier: "HOT",
    },
    select: {
      id: true,
      reference: true,
      claimYear: true,
      claimedAmount: true,
      status: true,
      company: {
        select: {
          id: true,
          legalName: true,
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
    orderBy: {
      updatedAt: "desc",
    },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Claims
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Reimbursement claims
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Claim drafts created from approved and monitored Training Approval Requests.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {claims.length} shown
        </span>
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
        {claims.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-zinc-600">
            No reimbursement claim has been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Training</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Claimed amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-950">{claim.company.legalName}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {claim.company.areaOffice?.name ?? "No Area Office"}
                      </p>
                    </td>
                    <td className="px-4 py-4">{claim.reference}</td>
                    <td className="px-4 py-4">{claim.trainingRequest?.title ?? "Not linked"}</td>
                    <td className="px-4 py-4">{claim.claimYear ?? "Not provided"}</td>
                    <td className="px-4 py-4">{formatMoney(claim.claimedAmount)}</td>
                    <td className="px-4 py-4">{claim.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/claims/${claim.id}`}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-2 text-xs font-semibold text-zinc-800"
                      >
                        View claim
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
