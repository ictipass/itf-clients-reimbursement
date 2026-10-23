import Link from "next/link";
import { getServerSession } from "next-auth";

import { createClaimAction } from "@/app/(dashboard)/claims/actions";
import { SelectAllTrainings } from "@/app/(dashboard)/claims/select-all-trainings";
import { ClaimTestClockNotice } from "@/components/claim-test-clock-notice";
import { authOptions } from "@/lib/auth";
import { CLAIM_SUBMISSION_DEADLINE_NOTICE } from "@/lib/claim-policy";
import { canBrowseArchivedClaims, getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";
import { can, isItfRole } from "@/lib/rbac";

function formatMoney(value: { toString(): string } | null) {
  if (!value) {
    return "Not provided";
  }

  return `NGN ${Number(value.toString()).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ClaimsPage({ searchParams }: Readonly<{
  searchParams: Promise<{ createError?: string }>;
}>) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "EMPLOYER_VIEWER";
  const canCreateClaim = can(activeRole, "claims:submit");
  const visibilityWhere = await getClaimVisibilityWhere({ email: session?.user?.email, role: activeRole });
  const db = getDb();
  const requester = canCreateClaim && session?.user?.email
    ? await db.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          memberships: {
            where: { isActive: true },
            select: {
              organizationId: true,
            },
          },
        },
      })
    : null;
  const organizationIds = requester?.memberships
    .map((membership) => membership.organizationId)
    .filter((organizationId): organizationId is string => Boolean(organizationId)) ?? [];
  const eligibleTrainings = canCreateClaim
    ? await db.trainingRequest.findMany({
        where: {
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
            ...(isItfRole(activeRole)
              ? {}
              : {
                  organizationId: {
                    in: organizationIds,
                  },
                }),
          },
        },
        select: {
          id: true,
          title: true,
          approvalReference: true,
          startsAt: true,
          endsAt: true,
          estimatedCost: true,
          company: {
            select: {
              id: true,
              legalName: true,
            },
          },
        },
        orderBy: [
          {
            company: {
              legalName: "asc",
            },
          },
          {
            startsAt: "desc",
          },
        ],
      })
    : [];
  const eligibleTrainingsByCompany = eligibleTrainings.reduce(
    (groups, training) => {
      const companyTrainings = groups.get(training.company.id) ?? [];
      companyTrainings.push(training);
      groups.set(training.company.id, companyTrainings);
      return groups;
    },
    new Map<string, typeof eligibleTrainings>(),
  );
  const claims = await db.reimbursementClaim.findMany({
    where: {
      recordTier: "HOT",
      status: { not: "ARCHIVED" },
      AND: [visibilityWhere],
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
      trainingRequests: {
        select: {
          trainingRequest: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          attachedAt: "asc",
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
            Raise a claim and attach one or more approved, monitored trainings as its evidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canBrowseArchivedClaims(activeRole) ? <Link href="/claims/archive" className="rounded-md border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020]">Browse archived claims by Area Office</Link> : null}
          <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">{claims.length} active shown</span>
        </div>
      </div>

      <div className="mt-6 rounded-lg border-2 border-red-300 bg-red-50 px-5 py-4 text-sm font-black uppercase leading-6 tracking-wide text-red-900 shadow-sm">
        {CLAIM_SUBMISSION_DEADLINE_NOTICE}
      </div>
      <ClaimTestClockNotice />

      {canCreateClaim ? (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Create reimbursement claim</h2>
          {query.createError ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-900">{query.createError}</p> : null}
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Select one or more available trainings for the same company. Their estimated costs
            provide the claim&apos;s starting amount. Annual compliance payment must be verified first.
          </p>
          {eligibleTrainings.length === 0 ? (
            <p className="mt-4 rounded-md bg-zinc-50 p-4 text-sm text-zinc-600">
              No approved and monitored training is currently available for a new claim.
            </p>
          ) : (
            <div className="mt-5 grid gap-4">
              {[...eligibleTrainingsByCompany.values()].map((trainings) => (
                <form
                  key={trainings[0].company.id}
                  action={createClaimAction}
                  className="rounded-lg border border-zinc-200 p-4"
                >
                  <h3 className="font-semibold text-zinc-950">
                    {trainings[0].company.legalName}
                  </h3>
                  <SelectAllTrainings />
                  <div className="mt-3 grid gap-2">
                    {trainings.map((training) => (
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
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-zinc-950">
                            {training.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            {training.approvalReference ?? "Approval reference pending"} ·{" "}
                            {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                              training.startsAt,
                            )}{" "}
                            · {formatMoney(training.estimatedCost)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                    Create claim with selected trainings
                  </button>
                </form>
              ))}
            </div>
          )}
        </section>
      ) : null}

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
                  <th className="px-4 py-3">Trainings</th>
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
                    <td className="px-4 py-4">
                      {claim.trainingRequests.length === 0
                        ? "Not linked"
                        : claim.trainingRequests
                            .map(({ trainingRequest }) => trainingRequest.title)
                            .join(", ")}
                    </td>
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
