import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";

import { writeAuditEvent } from "@/lib/audit";
import {
  ClaimAnalyticsAccessError,
  getClaimAnalyticsSummary,
  listClaimAnalyticsDetails,
  normalizeClaimAnalyticsFilters,
  type ClaimAnalyticsFilters,
  type ClaimAnalyticsRequest,
} from "@/lib/claim-analytics";
import { getDb } from "@/lib/db";

export const CLAIM_ANALYTICS_EXPORT_LIMIT = 5000;

export const claimAnalyticsMetricDefinitions = [
  ["Submitted claimed gross", "Employer demand on non-rejected submitted claims; not an award."],
  ["Active reviewed gross", "Current review recommendation on active claims; not a final award."],
  ["Approved outstanding gross", "DG payment-approved active awards without a payment date; before deductions."],
  ["Paid gross", "Recommended award on a claim marked paid with a payment date."],
  ["Confirmed deductions", "Recorded WHT plus Tax Off on paid claims with a valid complete breakdown."],
  ["Confirmed net paid", "Recorded paid gross less WHT and Tax Off where the breakdown is valid; not bank-reconciled settlement."],
  ["Missing paid breakdown", "Paid records without complete valid award and deduction values; excluded from confirmed net."],
] as const;

const queryKeys = ["companyId", "areaOfficeId", "trainingYears", "submissionYears", "paymentYears", "status", "policyEdition", "yearBasis"] as const;

export function claimAnalyticsFilterParams(params: URLSearchParams) {
  const selected = new URLSearchParams();
  for (const key of queryKeys) for (const value of params.getAll(key)) selected.append(key, value);
  return selected;
}

function years(value: string | null, label: string) {
  if (value === null || !value.trim()) return undefined;
  if (value.length > 300) throw new Error(`Enter valid ${label} (up to 50 comma-separated years).`);
  const parts = value.split(",").map((part) => part.trim());
  if (parts.some((part) => !/^\d{4}$/.test(part))) throw new Error(`Enter valid ${label} as four-digit years separated by commas.`);
  return parts.map(Number);
}

export function parseClaimAnalyticsFilters(params: URLSearchParams): ClaimAnalyticsFilters {
  const filters: ClaimAnalyticsFilters = {
    companyIds: params.has("companyId") ? params.getAll("companyId") : undefined,
    areaOfficeIds: params.has("areaOfficeId") ? params.getAll("areaOfficeId") : undefined,
    trainingYears: years(params.get("trainingYears"), "training years"),
    submissionYears: years(params.get("submissionYears"), "submission years"),
    paymentYears: years(params.get("paymentYears"), "payment years"),
    statuses: params.has("status") ? params.getAll("status") : undefined,
    policyEditions: params.getAll("policyEdition").filter(Boolean).length ? params.getAll("policyEdition").filter(Boolean) : undefined,
    yearBasis: (params.get("yearBasis") || "TRAINING") as ClaimAnalyticsFilters["yearBasis"],
  };
  return normalizeClaimAnalyticsFilters(filters);
}

export function claimAnalyticsParamsFromRecord(record: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const key of queryKeys) {
    const value = record[key];
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  return params;
}

export type ClaimAnalyticsExport = Awaited<ReturnType<typeof collectClaimAnalyticsExport>>;

export class ClaimAnalyticsExportTooLargeError extends Error {
  constructor() {
    super(`This report exceeds ${CLAIM_ANALYTICS_EXPORT_LIMIT.toLocaleString("en-NG")} claims. Narrow the filters before exporting.`);
  }
}

export function assertClaimAnalyticsExportSize(count: number) {
  if (count > CLAIM_ANALYTICS_EXPORT_LIMIT) throw new ClaimAnalyticsExportTooLargeError();
}

/** Collect only the bounded, privacy-minimized detail projection. Never export bank or participant data. */
export async function collectClaimAnalyticsExport(input: ClaimAnalyticsRequest, generatedAt = new Date(), reportId: string = randomUUID()) {
  const summary = await getClaimAnalyticsSummary(input);
  assertClaimAnalyticsExportSize(summary.totals.claimCount);
  const rows: Awaited<ReturnType<typeof listClaimAnalyticsDetails>>["rows"] = [];
  let afterId: string | undefined;
  do {
    const page = await listClaimAnalyticsDetails({ ...input, limit: 500, afterId });
    rows.push(...page.rows);
    assertClaimAnalyticsExportSize(rows.length);
    afterId = page.nextCursor ?? undefined;
  } while (afterId);
  if (rows.length !== summary.totals.claimCount) {
    throw new Error("Claims changed during report generation. Please retry the export.");
  }
  return { reportId, generatedAt: generatedAt.toISOString(), summary, rows };
}

/** Audit generation before delivery; if the audit write fails, no export file is served. */
export async function recordClaimAnalyticsExport(input: ClaimAnalyticsRequest, report: ClaimAnalyticsExport, format: "csv" | "xlsx") {
  const actor = await getDb().user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, email: true, isActive: true, memberships: {
      where: { isActive: true, role: input.requesterRole }, select: { workspaceId: true },
    } },
  });
  if (!actor?.isActive || !actor.memberships.length) throw new ClaimAnalyticsAccessError("An active FSD role assignment is required.");
  await Promise.all([...new Set(actor.memberships.map((membership) => membership.workspaceId))].map((workspaceId) =>
    writeAuditEvent({
      action: "CREATE", workspaceId,
      actor: { id: actor.id, email: actor.email, role: input.requesterRole },
      entityType: "ClaimAnalyticsExport", entityId: report.reportId,
      reason: "Operational FSD claim analytics report generated for download.",
      metadata: { format, actorRole: input.requesterRole, generatedAt: report.generatedAt, claimCount: report.rows.length,
        filters: JSON.stringify(report.summary.filters), operationalOnly: true },
    })));
}

const detailColumns = [
  ["Claim reference", "reference"], ["Company", "companyName"], ["Original Area Office", "areaOfficeName"],
  ["Training year", "claimYear"], ["Submitted at UTC", "submittedAt"], ["Paid at UTC", "paidAt"],
  ["Status", "status"], ["Policy edition", "policyEdition"], ["Employer claimed gross NGN", "claimedAmount"],
  ["Current recommendation gross NGN", "currentRecommendationGross"], ["Paid gross NGN", "paidGross"],
  ["Confirmed paid net NGN", "paidNetConfirmed"], ["Paid breakdown missing", "paidMissingBreakdown"],
  ["Claim ID", "id"],
] as const;

/** A quoted text cell with formula-like input neutralized for Excel-compatible CSV viewers. */
export function claimAnalyticsCsvCell(value: unknown) {
  const source = value === null || value === undefined ? "" : String(value);
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(source) ? `'${source}` : source;
  return `"${safe.replaceAll('"', '""')}"`;
}

const csvLine = (values: readonly unknown[]) => `${values.map(claimAnalyticsCsvCell).join(",")}\r\n`;

export function buildClaimAnalyticsCsv(report: ClaimAnalyticsExport) {
  const lines = [
    csvLine(["ITF FSD CLAIM ANALYTICS — OPERATIONAL, NOT AN OFFICIAL FINANCIAL STATEMENT"]),
    csvLine(["Report ID", report.reportId]),
    csvLine(["Generated at UTC", report.generatedAt]),
    csvLine(["Filters", JSON.stringify(report.summary.filters)]),
    csvLine(["Scope", "Current authorized FSD role and workspace; no employer drafts; archive access included"]),
    csvLine(["Consistency", "Generated-at timestamp, not a point-in-time database snapshot; rerun if operational facts change"]),
  ];
  for (const [label, meaning] of claimAnalyticsMetricDefinitions) lines.push(csvLine([label, meaning]));
  for (const [label, value] of Object.entries(report.summary.totals)) lines.push(csvLine([`Total: ${label}`, value]));
  lines.push("\r\n", csvLine(detailColumns.map(([label]) => label)));
  for (const row of report.rows) lines.push(csvLine(detailColumns.map(([, key]) => row[key])));
  return `\uFEFF${lines.join("")}`;
}

function addFactsWorksheet(workbook: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  const sheet = workbook.addWorksheet(name);
  if (!rows.length) return;
  const headings = Object.keys(rows[0]);
  sheet.addRow(headings);
  for (const row of rows) sheet.addRow(headings.map((heading) => row[heading] ?? ""));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 23; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(headings.length).letter}${sheet.rowCount}` };
}

export async function buildClaimAnalyticsWorkbook(report: ClaimAnalyticsExport) {
  const workbook = new ExcelJS.Workbook();
  const metadata = workbook.addWorksheet("Report notes");
  metadata.addRows([
    ["ITF FSD claim analytics — operational, not an official financial statement"],
    ["Report ID", report.reportId], ["Generated at UTC", report.generatedAt],
    ["Filters", JSON.stringify(report.summary.filters)],
    ["Scope", "Current authorized FSD role and workspace; no employer drafts; archive access included"],
    ["Consistency", "Generated-at timestamp, not a point-in-time database snapshot"],
    ...claimAnalyticsMetricDefinitions,
  ]);
  metadata.getColumn(1).width = 36;
  metadata.getColumn(2).width = 100;
  addFactsWorksheet(workbook, "Totals", [report.summary.totals]);
  addFactsWorksheet(workbook, "By training or payment year", report.summary.byYear);
  addFactsWorksheet(workbook, "By original Area Office", report.summary.byAreaOffice);
  addFactsWorksheet(workbook, "By company", report.summary.byCompany);
  const claims = workbook.addWorksheet("Claims");
  claims.addRow(detailColumns.map(([label]) => label));
  for (const row of report.rows) claims.addRow(detailColumns.map(([, key]) => row[key] ?? ""));
  claims.getRow(1).font = { bold: true };
  claims.columns.forEach((column) => { column.width = 24; });
  claims.views = [{ state: "frozen", ySplit: 1 }];
  claims.autoFilter = { from: "A1", to: `N${Math.max(1, claims.rowCount)}` };
  return workbook.xlsx.writeBuffer();
}
