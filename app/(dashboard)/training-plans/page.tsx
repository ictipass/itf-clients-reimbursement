import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveEmployerOrganization } from "@/lib/organization-context";
import { isItfRole } from "@/lib/rbac";
import { getItfTrainingPlanCompanyWhere } from "@/lib/training-plan-access";

function readFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();

  return trimmed ? trimmed : undefined;
}

function readPositiveInteger(value: string | string[] | undefined, fallback = 1) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function buildTrainingPlanHref(searchParams: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();

  return queryString ? `/training-plans?${queryString}` : "/training-plans";
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function getTrainingPlanStatusBadgeClass(status: string) {
  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "REJECTED") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "SUBMITTED" || status === "IN_REVIEW") {
    return "bg-orange-50 text-orange-700 ring-orange-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function TrainingPlanStatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${getTrainingPlanStatusBadgeClass(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default async function TrainingPlanListPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    year?: string | string[];
    status?: string | string[];
    desk?: string | string[];
    company?: string | string[];
    page?: string | string[];
  }>;
}>) {
  const query = await searchParams;
  const year = readFilter(query.year);
  const status = readFilter(query.status);
  const desk = readFilter(query.desk);
  const companyName = readFilter(query.company);
  const requestedPage = readPositiveInteger(query.page);
  const pageSize = 15;
  const db = getDb();
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const activeOrganization = isItfRole(session.user.role)
    ? null
    : (await getActiveEmployerOrganization(session.user.email)).active;
  const companyScopeWhere = isItfRole(session.user.role)
    ? await getItfTrainingPlanCompanyWhere(session.user.email, session.user.role)
    : { organizationId: activeOrganization?.id ?? "__no_active_organization__" };
  const where = {
    recordTier: "HOT" as const,
    ...(year ? { year: Number.parseInt(year, 10) } : {}),
    ...(status ? { status: status as never } : {}),
    ...(desk ? { currentDesk: desk as never } : {}),
    company: {
      ...companyScopeWhere,
      ...(companyName
        ? {
            legalName: {
              contains: companyName,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
  };
  const totalSubmissions = await db.trainingPlanSubmission.count({ where });
  const totalPages = Math.max(Math.ceil(totalSubmissions / pageSize), 1);
  const page = clampPage(requestedPage, totalPages);
  const submissions = await db.trainingPlanSubmission.findMany({
    where,
    select: {
      id: true,
      year: true,
      status: true,
      currentDesk: true,
      dueDate: true,
      submittedAt: true,
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
      _count: {
        select: {
          documents: true,
          personnel: true,
        },
      },
    },
    orderBy: [{ year: "desc" }, { updatedAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const pageQuery = {
    company: companyName,
    year,
    status,
    desk,
    page: page > 1 ? page : undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Training Plan
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Training Plan and L&amp;D submissions
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Browse yearly Form 3A/L&amp;D submissions across companies, statuses, desks, and Area
            Offices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/training-plans/csv-preview"
            className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
          >
            Preview CSV
          </Link>
          <span className="inline-flex min-h-10 items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-700">
            {totalSubmissions} matched
          </span>
        </div>
      </div>

      <form className="mt-8 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-5">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Company
          <input
            name="company"
            defaultValue={companyName}
            className="min-h-10 rounded-md border border-zinc-200 px-3"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Year
          <input
            name="year"
            type="number"
            defaultValue={year}
            className="min-h-10 rounded-md border border-zinc-200 px-3"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="min-h-10 rounded-md border border-zinc-200 px-3"
          >
            <option value="">Any status</option>
            {["DRAFT", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"].map(
              (value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Desk
          <select
            name="desk"
            defaultValue={desk ?? ""}
            className="min-h-10 rounded-md border border-zinc-200 px-3"
          >
            <option value="">Any desk</option>
            {["COMPANY", "AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"].map(
              (value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </label>
        <div className="flex items-end">
          <button className="min-h-10 w-full rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
            Apply filters
          </button>
        </div>
        <FormActionProgress />
      </form>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white">
        {submissions.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-zinc-600">
            No Training Plan submissions match the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Desk</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-950">
                        {submission.company.legalName}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {submission.company.areaOffice?.name ?? "No Area Office"}
                      </p>
                    </td>
                    <td className="px-4 py-4">{submission.year}</td>
                    <td className="px-4 py-4">
                      <TrainingPlanStatusBadge status={submission.status} />
                    </td>
                    <td className="px-4 py-4">{submission.currentDesk.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4">
                      {submission._count.documents} document{submission._count.documents === 1 ? "" : "s"} ·{" "}
                      {submission._count.personnel} personnel
                    </td>
                    <td className="px-4 py-4">{formatDate(submission.dueDate)}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/training-plans/${submission.id}`}
                        aria-label={`View training plan for ${submission.company.legalName}, ${submission.year}`}
                        title="View details"
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {totalSubmissions > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-zinc-600">
            Showing {submissions.length} of {totalSubmissions} submission
            {totalSubmissions === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            {page > 1 ? (
              <Link
                href={buildTrainingPlanHref({ ...pageQuery, page: page - 1 })}
                className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildTrainingPlanHref({ ...pageQuery, page: page + 1 })}
                className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
