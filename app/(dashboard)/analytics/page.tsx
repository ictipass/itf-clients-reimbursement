import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { FormActionProgress } from "@/components/form-action-progress";
import { authOptions } from "@/lib/auth";
import { canViewClaimAnalytics, ClaimAnalyticsAccessError, getClaimAnalyticsDimensions, getClaimAnalyticsSummary, listClaimAnalyticsDetails } from "@/lib/claim-analytics";
import { CLAIM_ANALYTICS_EXPORT_LIMIT, claimAnalyticsFilterParams, claimAnalyticsParamsFromRecord, parseClaimAnalyticsFilters } from "@/lib/claim-analytics-report";

const statuses = ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "SETTLED", "ARCHIVED"];
const inputClass = "min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950";

function naira(value: string) {
  const [whole, fraction = "00"] = value.split(".");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

function percent(value: string, maximum: number) {
  return maximum > 0 ? `${Math.max(2, Math.min(100, Number(value) / maximum * 100))}%` : "0%";
}

function metric(label: string, value: string | number, note: string) {
  return <div className="rounded-lg border border-zinc-200 bg-white p-4" key={label}>
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
    <p className="mt-2 text-xs leading-5 text-zinc-600">{note}</p>
  </div>;
}

export default async function ClaimAnalyticsPage({ searchParams }: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !canViewClaimAnalytics(session.user.role)) notFound();
  const query = await searchParams;
  const params = claimAnalyticsParamsFromRecord(query);
  let validationError: string | null = null;
  let filters: ReturnType<typeof parseClaimAnalyticsFilters> | null = null;
  try { filters = parseClaimAnalyticsFilters(params); }
  catch (error) { validationError = error instanceof Error ? error.message : "The selected filters are invalid."; }

  const cursor = typeof query.cursor === "string" ? query.cursor : undefined;
  if (query.cursor !== undefined && (!cursor || cursor.length > 128)) {
    validationError = "The analytics page cursor is invalid. Clear filters and try again.";
    filters = null;
  }

  const requester = { requesterEmail: session.user.email, requesterRole: session.user.role };
  const companySearch = typeof query.companySearch === "string" ? query.companySearch.trim().slice(0, 100) : "";
  let dimensions: Awaited<ReturnType<typeof getClaimAnalyticsDimensions>>;
  let summary: Awaited<ReturnType<typeof getClaimAnalyticsSummary>> | null = null;
  let details: Awaited<ReturnType<typeof listClaimAnalyticsDetails>> | null = null;
  try {
    dimensions = await getClaimAnalyticsDimensions({ ...requester, filters: { companyIds: filters?.companyIds } }, companySearch);
    if (filters) [summary, details] = await Promise.all([
      getClaimAnalyticsSummary({ ...requester, filters }),
      listClaimAnalyticsDetails({ ...requester, filters, afterId: cursor, limit: 50 }),
    ]);
  } catch (error) {
    if (error instanceof ClaimAnalyticsAccessError) notFound();
    throw error;
  }
  const exportParams = claimAnalyticsFilterParams(params);
  const exportHref = (format: "csv" | "xlsx") => `/analytics/export?${new URLSearchParams([...exportParams, ["format", format]]).toString()}`;
  const nextParams = new URLSearchParams(exportParams);
  if (details?.nextCursor) nextParams.set("cursor", details.nextCursor);
  const yearMaximum = Math.max(0, ...(summary?.byYear.map((row) => Number(row.submittedClaimedGross)) ?? []));
  const officeMaximum = Math.max(0, ...(summary?.byAreaOffice.map((row) => Number(row.paidNetConfirmed)) ?? []));
  const canExport = Boolean(summary && summary.totals.claimCount <= CLAIM_ANALYTICS_EXPORT_LIMIT);

  return <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Field Services Department</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Claim analytics</h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">Explore submitted and archived claim facts within your authorized desk scope. HQ reimbursement officers see their named assignments and archived packets only. Employer drafts and bank or participant details are excluded.</p>
      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">Operational figures, not an official financial statement. Finance must sign off the metric definitions before formal use. Generated data is not a point-in-time database snapshot.</p>
      <form className="mt-5 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium">Find companies
          <input name="companySearch" defaultValue={companySearch} placeholder="Name, then apply filters" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium">Company (one or many)
          <select name="companyId" multiple size={5} defaultValue={filters?.companyIds ?? []} className={inputClass}>
            {dimensions.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <span className="text-xs font-normal text-zinc-500">Ctrl-click to select several; leave empty for all in your scope. {dimensions.companyLimitReached ? "Search to find companies beyond this list." : ""}</span>
        </label>
        <label className="grid gap-1 text-sm font-medium">Original Area Office (one or many)
          <select name="areaOfficeId" multiple size={5} defaultValue={filters?.areaOfficeIds ?? []} className={inputClass}>
            {dimensions.offices.filter((office) => office.id).map((office) => <option key={office.id} value={office.id!}>{office.name}</option>)}
          </select>
          <span className="text-xs font-normal text-zinc-500">Claim submission-time office; archived records keep their original office.</span>
        </label>
        <label className="grid gap-1 text-sm font-medium">Training year(s)
          <input name="trainingYears" defaultValue={params.get("trainingYears") ?? ""} placeholder="2025, 2026" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium">Submission year(s) UTC
          <input name="submissionYears" defaultValue={params.get("submissionYears") ?? ""} placeholder="2026" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium">Payment year(s) UTC
          <input name="paymentYears" defaultValue={params.get("paymentYears") ?? ""} placeholder="2027" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium">Claim status
          <select name="status" multiple size={4} defaultValue={filters?.statuses ?? []} className={inputClass}>
            {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">Policy edition
          <select name="policyEdition" defaultValue={filters?.policyEditions?.[0] ?? ""} className={inputClass}>
            <option value="">All supported editions</option><option value="EIGHTH_REVISED">8th Revised</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">Compare years by
          <select name="yearBasis" defaultValue={filters?.yearBasis ?? "TRAINING"} className={inputClass}>
            <option value="TRAINING">Training year</option><option value="SUBMISSION">Submission year (UTC)</option><option value="PAYMENT">Payment year (UTC)</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-3">
          <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Apply filters</button>
          <Link href="/analytics" className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold">Clear filters</Link>
        </div>
        <FormActionProgress />
      </form>
      {validationError ? <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{validationError}</p> : null}
    </section>

    {summary ? <>
      <section aria-label="Claim totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metric("Submitted claimed gross", naira(summary.totals.submittedClaimedGross), "Employer demand; not an approved award")}
        {metric("Active reviewed gross", naira(summary.totals.activeReviewedGross), "Current recommendations, subject to review")}
        {metric("DG-approved outstanding", naira(summary.totals.approvedOutstandingGross), "Gross amount approved but not paid")}
        {metric("Paid gross", naira(summary.totals.paidGross), `${summary.totals.paidCount} paid claim(s)`) }
        {metric("Confirmed deductions", naira(summary.totals.paidDeductionsConfirmed), "Recorded WHT and Tax Off")}
        {metric("Confirmed net paid", naira(summary.totals.paidNetConfirmed), "Not yet bank-reconciled settlement")}
        {metric("Claims in scope", summary.totals.claimCount, `${summary.totals.activeCount} active; ${summary.totals.archivedCount} archived`)}
        {metric("Paid breakdown missing", summary.totals.paidMissingBreakdown, "Excluded from confirmed net figure")}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Year trend</h2>
          <p className="mt-1 text-xs text-zinc-600">Grouped by {summary.yearBasis.toLowerCase()} year. Bars show employer claim demand, not awards.</p>
          <div className="mt-4 space-y-4">
            {summary.byYear.length ? summary.byYear.map((row) => <div key={row.year ?? "undated"}>
              <div className="flex justify-between gap-2 text-sm"><span>{row.year ?? "Year unavailable"}</span><span>{naira(row.submittedClaimedGross)} · {row.claimCount} claim(s)</span></div>
              <div className="mt-1 h-3 rounded-full bg-zinc-100"><div className="h-3 rounded-full bg-[#800020]" style={{ width: percent(row.submittedClaimedGross, yearMaximum) }} /></div>
              <p className="mt-1 text-xs text-zinc-600">Confirmed net paid {naira(row.paidNetConfirmed)}</p>
            </div>) : <p className="text-sm text-zinc-600">No claims match these filters.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Area Office comparison</h2>
          <p className="mt-1 text-xs text-zinc-600">Original Area Office; bars show confirmed net paid only.</p>
          <div className="mt-4 max-h-96 space-y-4 overflow-y-auto">
            {summary.byAreaOffice.length ? summary.byAreaOffice.map((row) => <div key={row.areaOfficeId ?? "unknown"}>
              <div className="flex justify-between gap-2 text-sm"><span>{row.areaOfficeName}</span><span>{naira(row.paidNetConfirmed)} · {row.claimCount} claim(s)</span></div>
              <div className="mt-1 h-3 rounded-full bg-zinc-100"><div className="h-3 rounded-full bg-emerald-700" style={{ width: percent(row.paidNetConfirmed, officeMaximum) }} /></div>
            </div>) : <p className="text-sm text-zinc-600">No Area Office totals match.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Company comparison</h2><p className="mt-1 text-xs text-zinc-600">Up to 50 companies shown; use filters or export for the full authorized result.</p></div>
          <span className="text-sm text-zinc-600">{summary.byCompany.length} company/companies</span>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-600"><tr><th className="py-2">Company</th><th>Claims</th><th>Claimed gross</th><th>Paid gross</th><th>Confirmed net</th></tr></thead><tbody>
          {summary.byCompany.slice(0, 50).map((row) => <tr key={row.companyId} className="border-b border-zinc-100"><td className="py-2 font-medium">{row.companyName}</td><td>{row.claimCount}</td><td>{naira(row.submittedClaimedGross)}</td><td>{naira(row.paidGross)}</td><td>{naira(row.paidNetConfirmed)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Claim detail and export</h2><p className="mt-1 text-xs text-zinc-600">{summary.totals.claimCount} claims match. The list shows 50 per page. Archived claims link to their authorized packet.</p></div>
          <div className="flex flex-wrap gap-2">
            {canExport ? <><a href={exportHref("csv")} className="rounded-md border border-[#800020] px-3 py-2 text-sm font-semibold text-[#800020]">Download CSV</a><a href={exportHref("xlsx")} className="rounded-md bg-[#800020] px-3 py-2 text-sm font-semibold text-white">Download Excel</a></> : <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">More than {CLAIM_ANALYTICS_EXPORT_LIMIT.toLocaleString("en-NG")} claims; narrow the filters to export.</span>}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-600"><tr><th className="py-2">Reference</th><th>Company</th><th>Training year</th><th>Status</th><th>Claimed gross</th><th>Paid net confirmed</th></tr></thead><tbody>
          {details?.rows.map((row) => <tr key={row.id} className="border-b border-zinc-100"><td className="py-2 font-semibold">{row.status === "ARCHIVED" ? <Link href={`/claims/${row.id}`} className="text-[#800020] underline">{row.reference}</Link> : row.reference}</td><td>{row.companyName}</td><td>{row.claimYear ?? "—"}</td><td>{row.status.replaceAll("_", " ")}</td><td>{naira(row.claimedAmount)}</td><td>{row.paidNetConfirmed ? naira(row.paidNetConfirmed) : row.paidMissingBreakdown ? "Breakdown missing" : "—"}</td></tr>)}
        </tbody></table></div>
        {details?.rows.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No claim details match.</p> : null}
        <nav aria-label="Analytics result pages" className="mt-4 flex gap-2 text-sm font-semibold">
          {typeof query.cursor === "string" ? <Link href={`/analytics?${exportParams.toString()}`} className="rounded-md border border-zinc-300 px-3 py-2">First page</Link> : null}
          {details?.nextCursor ? <Link href={`/analytics?${nextParams.toString()}`} className="rounded-md border border-zinc-300 px-3 py-2">Next 50</Link> : null}
        </nav>
      </section>
    </> : null}
  </div>;
}
