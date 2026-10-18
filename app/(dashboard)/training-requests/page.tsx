import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatMoney(value: { toString(): string } | null) {
  if (!value) {
    return "Not provided";
  }

  return `NGN ${Number(value.toString()).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function TrainingRequestsPage() {
  const session = await getServerSession(authOptions);
  const canCreate = can(session?.user?.role ?? "SYSTEM_ADMIN", "training:submit");
  const requests = await getDb().trainingRequest.findMany({
    where: {
      recordTier: "HOT",
    },
    select: {
      id: true,
      title: true,
      provider: true,
      startsAt: true,
      endsAt: true,
      estimatedCost: true,
      status: true,
      currentDesk: true,
      isAdHoc: true,
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
      trainingPlanLineItem: {
        select: {
          trainingTitle: true,
          staffName: true,
          department: true,
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
            Training approval
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Training Approval Requests
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Submit Form 4A approval requests for each training, whether or not it appears in an
            approved annual Training Plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <Link href="/training-requests/new" className="rounded-md bg-[#800020] px-4 py-2 text-sm font-semibold text-white">
              Request Approval for Training
            </Link>
          ) : null}
          <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
            {requests.length} shown
          </span>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
        {requests.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-zinc-600">
            No Training Approval Requests have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Training</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Desk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-950">{request.company.legalName}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {request.company.areaOffice?.name ?? "No Area Office"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{request.title}</p>
                      {request.isAdHoc ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Not linked to plan
                        </span>
                      ) : null}
                      {request.trainingPlanLineItem ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          From plan: {request.trainingPlanLineItem.trainingTitle}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">{request.provider}</td>
                    <td className="px-4 py-4">
                      {formatDate(request.startsAt)} - {formatDate(request.endsAt)}
                    </td>
                    <td className="px-4 py-4">{formatMoney(request.estimatedCost)}</td>
                    <td className="px-4 py-4">{request.currentDesk.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">{request.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/training-requests/${request.id}`}
                        className="mr-2 inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-2 text-xs font-semibold text-zinc-800"
                      >
                        View detail
                      </Link>
                      <Link
                        href={`/registry/${request.company.id}`}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-2 text-xs font-semibold text-zinc-800"
                      >
                        Open company
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
