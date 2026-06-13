import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isItfRole } from "@/lib/rbac";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

export default async function TrainingMonitoringPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const db = getDb();
  const requester = session?.user?.email
    ? await db.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          memberships: {
            where: {
              isActive: true,
            },
            select: {
              organizationId: true,
              areaOfficeId: true,
            },
          },
        },
      })
    : null;
  const organizationIds = requester?.memberships
    .map((membership) => membership.organizationId)
    .filter((id): id is string => Boolean(id)) ?? [];
  const areaOfficeIds = requester?.memberships
    .map((membership) => membership.areaOfficeId)
    .filter((id): id is string => Boolean(id)) ?? [];
  const isAdmin = role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
  const records = await db.trainingMonitoringRecord.findMany({
    where: {
      recordTier: "HOT",
      ...(!isAdmin && isItfRole(role)
        ? {
            trainingRequest: {
              company: {
                areaOfficeId: {
                  in: areaOfficeIds,
                },
              },
            },
          }
        : {}),
      ...(!isAdmin && !isItfRole(role)
        ? {
            trainingRequest: {
              company: {
                organizationId: {
                  in: organizationIds,
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      mode: true,
      monitoringDate: true,
      status: true,
      currentDesk: true,
      decisionOutcome: true,
      trainingRequest: {
        select: {
          id: true,
          title: true,
          provider: true,
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
        },
      },
    },
    orderBy: [{ monitoringDate: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Training monitoring
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Area Office Monitoring Calendar
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Approved trainings scheduled for monitoring, review, and employer feedback.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {records.length} shown
        </span>
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
        {records.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-zinc-600">
            No Training Monitoring records have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Training</th>
                  <th className="px-4 py-3">Form</th>
                  <th className="px-4 py-3">Monitoring date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Current desk</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-950">
                        {record.trainingRequest.company.legalName}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {record.trainingRequest.company.areaOffice?.name ?? "No Area Office"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{record.trainingRequest.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {record.trainingRequest.provider}
                      </p>
                    </td>
                    <td className="px-4 py-4">{record.mode.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">{formatDate(record.monitoringDate)}</td>
                    <td className="px-4 py-4">{record.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">{record.currentDesk.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">
                      {record.decisionOutcome?.replaceAll("_", " ") ?? "Pending"}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/training-monitoring/${record.id}`}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-2 text-xs font-semibold text-zinc-800"
                      >
                        View record
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
