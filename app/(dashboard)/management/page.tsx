import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  canViewManagementDashboard,
  getManagementDashboard,
  listManagementDashboardAreaOffices,
} from "@/lib/management-dashboard";

function formatMoney(value: number) {
  return `NGN ${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseYear(value: string | undefined) {
  if (!value) {
    return new Date().getFullYear();
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return new Date().getFullYear();
  }

  return parsed;
}

function MetricCard({
  label,
  value,
  detail,
}: Readonly<{
  label: string;
  value: string | number;
  detail?: string;
}>) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{value}</p>
      {detail ? <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p> : null}
    </div>
  );
}

export default async function ManagementDashboardPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ year?: string; areaOfficeId?: string }>;
}>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const managementUser = session?.user?.email
    ? await getDb().user.findUnique({
        where: { email: session.user.email },
        select: { isManagement: true },
      })
    : null;
  const hasManagementAccess =
    Boolean(session?.user?.email) &&
    canViewManagementDashboard(role, managementUser?.isManagement ?? false);

  if (!hasManagementAccess) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Management
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Statistics dashboard</h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to view management statistics.
          </p>
        </section>
      </div>
    );
  }

  const requesterEmail = session?.user?.email;

  if (!requesterEmail) {
    throw new Error("Authentication is required.");
  }

  const params = await searchParams;
  const year = parseYear(params?.year);
  const areaOfficeId = params?.areaOfficeId?.trim() || undefined;
  const [areaOffices, dashboard] = await Promise.all([
    listManagementDashboardAreaOffices(),
    getManagementDashboard({
      requesterEmail,
      requesterRole: role,
      filters: {
        year,
        areaOfficeId,
      },
    }),
  ]);
  const visibleAreaOffices = dashboard.scope.allowedAreaOffices ?? areaOffices;
  const selectedAreaOfficeId = dashboard.filters.areaOfficeId ?? "";
  const scopeLabel =
    dashboard.scope.scopeType === "HQ" ? "HQ national scope" : "Area Office scope";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Management
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Statistics dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Live operational summary for employer registration, compliance revenue,
              reimbursement claims, and attention queues.
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#800020]/10 px-3 py-1 text-sm font-semibold text-[#65001a]">
            {scopeLabel} · {year}
          </span>
        </div>

        <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Year
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={year}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Area Office
            <select
              name="areaOfficeId"
              defaultValue={selectedAreaOfficeId}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
            >
              {dashboard.scope.scopeType === "HQ" ? <option value="">All Area Offices</option> : null}
              {visibleAreaOffices.map((areaOffice) => (
                <option key={areaOffice.id} value={areaOffice.id}>
                  {areaOffice.name}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
            Apply filters
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          HQ summary
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MetricCard
            label="Total revenue"
            value={formatMoney(dashboard.headline.totalRevenue)}
            detail="Registration plus annual compliance revenue"
          />
          <MetricCard
            label="Registration revenue"
            value={formatMoney(dashboard.headline.registrationRevenue)}
          />
          <MetricCard
            label="Compliance revenue"
            value={formatMoney(dashboard.headline.complianceRevenue)}
          />
          <MetricCard
            label="Claims paid"
            value={formatMoney(dashboard.headline.claimsPaid)}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registered companies"
          value={dashboard.headline.registeredCompanies}
          detail={`${dashboard.headline.activeCompanies} active of ${dashboard.headline.totalCompanies} total companies`}
        />
        <MetricCard
          label="Complied companies"
          value={dashboard.headline.complianceApproved}
          detail="Approved annual compliance records for selected year"
        />
        <MetricCard
          label="Revenue generated"
          value={formatMoney(dashboard.headline.totalRevenue)}
          detail={`${formatMoney(dashboard.headline.registrationRevenue)} registration, ${formatMoney(
            dashboard.headline.complianceRevenue,
          )} compliance`}
        />
        <MetricCard
          label="Reimbursement paid"
          value={formatMoney(dashboard.headline.claimsPaid)}
          detail={`${dashboard.headline.claimsPending} pending claims`}
        />
        <MetricCard
          label="Claim exposure"
          value={formatMoney(dashboard.headline.claimsRequested)}
          detail={`${formatMoney(dashboard.headline.claimsRecommended)} currently recommended`}
        />
        <MetricCard
          label="Completed registrations"
          value={dashboard.headline.approvedRegistrationApplications}
          detail="HQ-completed registrations for selected year"
        />
        <MetricCard
          label="Pending registrations"
          value={dashboard.headline.pendingRegistrationApplications}
          detail="Submitted, in review, or awaiting changes"
        />
        <MetricCard
          label="Attention queue"
          value={dashboard.headline.openWorkItems}
          detail={`${dashboard.headline.urgentWorkItems} high or urgent items`}
        />
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Area Office workload
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Operational distribution</h2>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Area Office</th>
                <th className="px-4 py-3">Companies</th>
                <th className="px-4 py-3">Pending registrations</th>
                <th className="px-4 py-3">Open work items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {dashboard.areaOfficeBreakdown.map((areaOffice) => (
                <tr key={areaOffice.id}>
                  <td className="px-4 py-4 font-semibold text-zinc-950">{areaOffice.name}</td>
                  <td className="px-4 py-4 text-zinc-700">{areaOffice.companies}</td>
                  <td className="px-4 py-4 text-zinc-700">{areaOffice.pendingRegistrations}</td>
                  <td className="px-4 py-4 text-zinc-700">{areaOffice.openWorkItems}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Area Office performance
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Revenue, compliance, and claims
            </h2>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Area Office</th>
                <th className="px-4 py-3">Complied</th>
                <th className="px-4 py-3">Registration revenue</th>
                <th className="px-4 py-3">Compliance revenue</th>
                <th className="px-4 py-3">Claims paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {dashboard.financialBreakdown.map((areaOffice) => (
                <tr key={areaOffice.id}>
                  <td className="px-4 py-4 font-semibold text-zinc-950">{areaOffice.name}</td>
                  <td className="px-4 py-4 text-zinc-700">{areaOffice.complianceApproved}</td>
                  <td className="px-4 py-4 text-zinc-700">
                    {formatMoney(areaOffice.registrationRevenue)}
                  </td>
                  <td className="px-4 py-4 text-zinc-700">
                    {formatMoney(areaOffice.complianceRevenue)}
                  </td>
                  <td className="px-4 py-4 text-zinc-700">
                    {formatMoney(areaOffice.claimsPaid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
