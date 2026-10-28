import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";
import { archiveDraftTrainingRequestAction } from "@/app/(dashboard)/training-requests/actions";
import { RemoveDraftButton } from "@/app/(dashboard)/training-requests/remove-draft-button";
import { getVisibleTrainingRequestWhere } from "@/lib/training-request-access";

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

export default async function TrainingRequestsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ routed?: string }> }>) {
  const { routed } = await searchParams;
  const session = await getServerSession(authOptions);
  const canCreate = Boolean(session?.user?.email && session.user.role && can(session.user.role, "training:submit"));
  const memberships = session?.user?.email
    ? await getDb().user.findUnique({
        where: { email: session.user.email },
        select: { memberships: { where: { isActive: true }, select: { organizationId: true } } },
      })
    : null;
  const organizationIds = new Set(memberships?.memberships.map((membership) => membership.organizationId));
  const visibleWhere = await getVisibleTrainingRequestWhere({
    email: session?.user?.email,
    role: session?.user?.role ?? "SYSTEM_ADMIN",
  });
  const requests = await getDb().trainingRequest.findMany({
    where: visibleWhere,
    select: {
      id: true,
      title: true,
      provider: true,
      startsAt: true,
      endsAt: true,
      estimatedCost: true,
      status: true,
      currentDesk: true,
      submittedAt: true,
      isAdHoc: true,
      company: {
        select: {
          id: true,
          legalName: true,
          organizationId: true,
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
              Request Unplanned Training
            </Link>
          ) : null}
          <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
            {requests.length} shown
          </span>
        </div>
      </div>

      {routed === "1" ? (
        <p role="status" className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Request forwarded successfully. It is now available to the next workflow desk.
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
        {requests.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-zinc-600">
            No Training Approval Requests are available to you.
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
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/training-requests/${request.id}`}
                          aria-label={`View Form 4A: ${request.title}`}
                          title="View Form 4A"
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                        </Link>
                        {canCreate && organizationIds.has(request.company.organizationId) && request.status === "DRAFT" && request.currentDesk === "COMPANY" && !request.submittedAt ? (
                          <form action={archiveDraftTrainingRequestAction.bind(null, request.id)}>
                            <RemoveDraftButton title={request.title} />
                            <FormActionProgress />
                          </form>
                        ) : null}
                      </div>
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
