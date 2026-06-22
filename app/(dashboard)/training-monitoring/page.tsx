import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isItfRole } from "@/lib/rbac";

const calendarTimeZone = "Africa/Lagos";
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: calendarTimeZone,
  }).format(date);
}

function formatDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: calendarTimeZone,
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}`;
}

function getCurrentMonthKey() {
  return formatDateKey(new Date()).slice(0, 7);
}

function parseMonthKey(value: string | undefined) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return null;
  }

  return value;
}

function parseDateKey(value: string | undefined) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null;
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getStatusClasses(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-800";
    case "CHANGES_REQUESTED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "IN_REVIEW":
    case "SUBMITTED":
      return "border-blue-200 bg-blue-50 text-blue-800";
    default:
      return "border-violet-200 bg-violet-50 text-violet-800";
  }
}

export default async function TrainingMonitoringPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ date?: string | string[]; month?: string | string[] }>;
}>) {
  const query = await searchParams;
  const requestedDate = parseDateKey(typeof query.date === "string" ? query.date : undefined);
  const requestedMonth = parseMonthKey(typeof query.month === "string" ? query.month : undefined);
  const monthKey = requestedDate?.slice(0, 7) ?? requestedMonth ?? getCurrentMonthKey();
  const [calendarYear, calendarMonth] = monthKey.split("-").map(Number);
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const showOfficerCalendar = isItfRole(role);
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

  const recordsByDate = new Map<string, typeof records>();

  for (const record of records) {
    if (!record.monitoringDate) {
      continue;
    }

    const key = formatDateKey(record.monitoringDate);
    recordsByDate.set(key, [...(recordsByDate.get(key) ?? []), record]);
  }

  const selectedRecords = requestedDate ? (recordsByDate.get(requestedDate) ?? []) : [];
  const firstDay = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
  const calendarCells = Array.from(
    { length: Math.ceil((firstDay + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - firstDay + 1;

      return day >= 1 && day <= daysInMonth ? day : null;
    },
  );
  const monthLabel = new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(calendarYear, calendarMonth - 1, 1)));
  const selectedDateLabel = requestedDate
    ? new Intl.DateTimeFormat("en-NG", {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${requestedDate}T00:00:00Z`))
    : null;

  const recordsTable = (rows: typeof records) => (
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
          {rows.map((record) => (
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
                <p className="mt-1 text-xs text-zinc-500">{record.trainingRequest.provider}</p>
              </td>
              <td className="px-4 py-4">{record.mode.replaceAll("_", " ")}</td>
              <td className="px-4 py-4">{formatDate(record.monitoringDate)}</td>
              <td className="px-4 py-4">
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getStatusClasses(record.status)}`}
                >
                  {record.status.replaceAll("_", " ")}
                </span>
              </td>
              <td className="px-4 py-4">{record.currentDesk.replaceAll("_", " ")}</td>
              <td className="px-4 py-4">
                {record.decisionOutcome?.replaceAll("_", " ") ?? "Pending"}
              </td>
              <td className="px-4 py-4">
                <Link
                  href={`/training-monitoring/${record.id}`}
                  className="inline-flex min-h-9 items-center rounded-md bg-[#800020] px-3 text-xs font-semibold text-white transition hover:bg-[#650019]"
                >
                  View record
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Training monitoring
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {showOfficerCalendar ? "Area Office Monitoring Calendar" : "Training Monitoring"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Approved trainings scheduled for monitoring, review, and employer feedback.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {records.length} shown
        </span>
      </div>

      {showOfficerCalendar ? (
        <>
          <section className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 sm:px-6">
              <Link
                href={`/training-monitoring?month=${shiftMonth(monthKey, -1)}`}
                aria-label="View previous month"
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                ← Previous
              </Link>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-zinc-950">{monthLabel}</h2>
                <p className="mt-1 text-xs text-zinc-500">Select a highlighted date</p>
              </div>
              <Link
                href={`/training-monitoring?month=${shiftMonth(monthKey, 1)}`}
                aria-label="View next month"
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Next →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarCells.map((day, index) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="min-h-32 border-b border-r border-zinc-100 bg-zinc-50/60"
                        />
                      );
                    }

                    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
                    const dayRecords = recordsByDate.get(dateKey) ?? [];
                    const isSelected = requestedDate === dateKey;

                    if (dayRecords.length === 0) {
                      return (
                        <div
                          key={dateKey}
                          className="min-h-32 border-b border-r border-zinc-100 p-3"
                        >
                          <span className="text-sm font-medium text-zinc-500">{day}</span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={dateKey}
                        href={`/training-monitoring?month=${monthKey}&date=${dateKey}#daily-trainings`}
                        scroll
                        className={`min-h-32 border-b border-r p-3 transition hover:bg-[#800020]/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#800020] ${
                          isSelected
                            ? "border-[#800020] bg-[#800020]/5"
                            : "border-zinc-100 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-zinc-950">{day}</span>
                          <span className="rounded-full bg-[#800020] px-2 py-0.5 text-[11px] font-bold text-white">
                            {dayRecords.length}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {dayRecords.slice(0, 2).map((record) => (
                            <div
                              key={record.id}
                              className={`truncate rounded border px-2 py-1 text-[11px] font-semibold ${getStatusClasses(record.status)}`}
                              title={`${record.trainingRequest.company.legalName}: ${record.trainingRequest.title}`}
                            >
                              {record.trainingRequest.title}
                            </div>
                          ))}
                          {dayRecords.length > 2 ? (
                            <p className="px-1 text-[11px] font-semibold text-zinc-500">
                              +{dayRecords.length - 2} more
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section
            id="daily-trainings"
            className="mt-8 scroll-mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
          >
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                {selectedDateLabel ? `Trainings for ${selectedDateLabel}` : "Daily trainings"}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {selectedDateLabel
                  ? `${selectedRecords.length} training${selectedRecords.length === 1 ? "" : "s"} scheduled for monitoring.`
                  : "Select a highlighted date in the calendar to view its scheduled trainings."}
              </p>
            </div>
            {requestedDate ? (
              selectedRecords.length > 0 ? (
                recordsTable(selectedRecords)
              ) : (
                <p className="p-5 text-sm leading-6 text-zinc-600">
                  No trainings are scheduled for monitoring on this date.
                </p>
              )
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">
                The table for a selected date will appear here.
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {records.length === 0 ? (
            <p className="p-5 text-sm leading-6 text-zinc-600">
              No Training Monitoring records have been created yet.
            </p>
          ) : (
            recordsTable(records)
          )}
        </section>
      )}
    </div>
  );
}
