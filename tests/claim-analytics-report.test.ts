import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { canViewClaimAnalytics } from "../lib/claim-analytics";
import {
  assertClaimAnalyticsExportSize,
  buildClaimAnalyticsCsv,
  buildClaimAnalyticsWorkbook,
  claimAnalyticsCsvCell,
  claimAnalyticsFilterParams,
  claimAnalyticsParamsFromRecord,
  parseClaimAnalyticsFilters,
  type ClaimAnalyticsExport,
} from "../lib/claim-analytics-report";
import { getVisibleNavGroups } from "../lib/navigation";
import { canAccessPath } from "../lib/feature-gates";

test("analytics link and export role are restricted to the three FSD reporting roles", () => {
  for (const role of ["DIRECTOR_FSD", "HEAD_OF_DIVISION", "HQ_REIMBURSEMENT_OFFICER"] as const) {
    assert.equal(canViewClaimAnalytics(role), true);
    assert.equal(getVisibleNavGroups(role).flatMap((group) => group.items).some((item) => item.href === "/analytics"), true);
    assert.equal(canAccessPath(role, "/analytics"), true);
    assert.equal(canAccessPath(role, "/analytics/export"), true);
  }
  for (const role of ["SYSTEM_ADMIN", "AREA_MANAGER", "EMPLOYER_ADMIN", "REIMBURSEMENT_SCHEDULE_AUDITOR"] as const) {
    assert.equal(canViewClaimAnalytics(role), false);
    assert.equal(getVisibleNavGroups(role).flatMap((group) => group.items).some((item) => item.href === "/analytics"), false);
    assert.equal(canAccessPath(role, "/analytics"), false);
    assert.equal(canAccessPath(role, "/analytics/export"), false);
  }
});

test("multi-company, year and policy filters round-trip while cursor and export format do not", () => {
  const params = claimAnalyticsParamsFromRecord({
    companyId: ["company-a", "company-b"], trainingYears: "2025, 2026", status: ["ARCHIVED", "IN_REVIEW"],
    policyEdition: "", yearBasis: "PAYMENT", cursor: "secret", format: "csv",
  });
  assert.deepEqual(params.getAll("companyId"), ["company-a", "company-b"]);
  assert.equal(params.has("cursor"), false);
  assert.equal(params.has("format"), false);
  assert.deepEqual(parseClaimAnalyticsFilters(params), {
    companyIds: ["company-a", "company-b"], areaOfficeIds: undefined,
    trainingYears: [2025, 2026], submissionYears: undefined, paymentYears: undefined,
    statuses: ["ARCHIVED", "IN_REVIEW"], policyEditions: undefined, yearBasis: "PAYMENT",
  });
  const exportParams = claimAnalyticsFilterParams(new URLSearchParams("status=ARCHIVED&cursor=forged&format=xlsx"));
  assert.equal(exportParams.toString(), "status=ARCHIVED");
  assert.throws(() => parseClaimAnalyticsFilters(new URLSearchParams("trainingYears=2025%2C+today")), /four-digit years/);
  assert.throws(() => parseClaimAnalyticsFilters(new URLSearchParams("yearBasis=UNKNOWN")), /valid analytics year basis/);
});

test("report size has an enforced upper bound", () => {
  assert.doesNotThrow(() => assertClaimAnalyticsExportSize(5000));
  assert.throws(() => assertClaimAnalyticsExportSize(5001), /Narrow the filters/);
});

const report = {
  reportId: "report-test-id", generatedAt: "2026-11-24T10:00:00.000Z",
  summary: {
    yearBasis: "TRAINING", filters: { yearBasis: "TRAINING" },
    totals: { claimCount: 1, archivedCount: 1, activeCount: 0, submittedClaimedGross: "100.00", activeReviewedGross: "0.00",
      approvedOutstandingGross: "0.00", paidCount: 1, paidGross: "75.00", paidDeductionsConfirmed: "5.00",
      paidNetConfirmed: "70.00", paidMissingBreakdown: 0 },
    byYear: [], byAreaOffice: [], byCompany: [],
  },
  rows: [{ id: "claim-1", reference: "=HYPERLINK(\"https://attacker.test\")", companyId: "company-1", companyName: "+PAYLOAD",
    areaOfficeId: "office-1", areaOfficeName: "Original", claimYear: 2025, submittedAt: null, paidAt: "2026-01-01T00:00:00.000Z",
    archivedAt: "2026-01-02T00:00:00.000Z", status: "ARCHIVED", policyEdition: "EIGHTH_REVISED", claimedAmount: "100.00",
    currentRecommendationGross: "75.00", paidGross: "75.00", paidNetConfirmed: "70.00", paidMissingBreakdown: false }],
} as ClaimAnalyticsExport;

test("CSV export includes report provenance, definitions, exact money and neutralizes formula-like cells", () => {
  assert.equal(claimAnalyticsCsvCell("=1+1"), '"\'=1+1"');
  assert.equal(claimAnalyticsCsvCell("\n+1+1"), '"\'\n+1+1"');
  const csv = buildClaimAnalyticsCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /report-test-id/);
  assert.match(csv, /Confirmed net paid/);
  assert.match(csv, /70\.00/);
  assert.match(csv, /'\+PAYLOAD/);
  assert.match(csv, /'=HYPERLINK/);
  assert.doesNotMatch(csv, /bank account|participant/i);
});

test("Excel export has provenance, grouped sheets and text-only untrusted company values", async () => {
  const buffer = await buildClaimAnalyticsWorkbook(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.equal(workbook.getWorksheet("Report notes")?.getCell("B2").value, "report-test-id");
  assert.equal(workbook.getWorksheet("Totals")?.getCell("B2").value, 1);
  assert.equal(workbook.getWorksheet("Claims")?.getCell("B2").value, "+PAYLOAD");
  assert.equal(workbook.getWorksheet("Claims")?.getCell("B2").type, ExcelJS.ValueType.String);
});
