import "../scripts/assert-integration-db";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { getClaimAnalyticsSummary, listClaimAnalyticsDetails } from "../lib/claim-analytics";
import { getDb } from "../lib/db";

test("FSD analytics isolate workspaces, preserve original office, reconcile net paid, and page details", async () => {
  const db = getDb();
  const suffix = randomUUID().replaceAll("-", "");
  const firstWorkspace = await db.workspace.create({ data: { name: `Analytics ${suffix}`, slug: `analytics-${suffix}` } });
  const otherWorkspace = await db.workspace.create({ data: { name: `Other analytics ${suffix}`, slug: `other-analytics-${suffix}` } });
  const originalOffice = await db.areaOffice.create({ data: { workspaceId: firstWorkspace.id, name: "Original Area", slug: `original-${suffix}` } });
  const newOffice = await db.areaOffice.create({ data: { workspaceId: firstWorkspace.id, name: "New Area", slug: `new-${suffix}` } });
  const firstOrg = await db.organization.create({ data: { workspaceId: firstWorkspace.id, name: "First Organization", slug: `first-org-${suffix}` } });
  const otherOrg = await db.organization.create({ data: { workspaceId: otherWorkspace.id, name: "Other Organization", slug: `other-org-${suffix}` } });
  const company = await db.company.create({ data: { organizationId: firstOrg.id, areaOfficeId: newOffice.id, legalName: "Renamed Employer" } });
  const otherCompany = await db.company.create({ data: { organizationId: otherOrg.id, legalName: "Private Employer" } });
  const officer = await db.user.create({ data: { name: "Analytics Officer", email: `analytics.${suffix}@example.test` } });
  const peer = await db.user.create({ data: { name: "Peer HQ Officer", email: `peer.${suffix}@example.test` } });
  const director = await db.user.create({ data: { name: "FSD Director", email: `director.${suffix}@example.test` } });
  const outsider = await db.user.create({ data: { name: "Unassigned Officer", email: `outsider.${suffix}@example.test` } });
  await db.membership.create({ data: { userId: officer.id, workspaceId: firstWorkspace.id, role: "HQ_REIMBURSEMENT_OFFICER" } });
  await db.membership.create({ data: { userId: peer.id, workspaceId: firstWorkspace.id, role: "HQ_REIMBURSEMENT_OFFICER" } });
  await db.membership.create({ data: { userId: director.id, workspaceId: firstWorkspace.id, role: "DIRECTOR_FSD" } });
  const request = { requesterEmail: officer.email, requesterRole: "HQ_REIMBURSEMENT_OFFICER" as const };
  const directorRequest = { requesterEmail: director.email, requesterRole: "DIRECTOR_FSD" as const };

  await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ANALYTICS-PAID-${suffix}`, claimYear: 2025, claimedAmount: 1000,
    claimRecommendedAmount: 800, paymentWithholdingTax: 50, paymentTaxOffset: 25,
    status: "ARCHIVED", paymentHandoffStatus: "PAID", claimAreaOfficeId: originalOffice.id,
    archiveAreaOfficeId: originalOffice.id, archiveAreaOfficeName: originalOffice.name,
    archiveCompanyName: "Historical Employer", paidAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: new Date("2026-01-01T00:00:00.000Z"), submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  } });
  await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ANALYTICS-LEGACY-${suffix}`, claimYear: 2025, claimedAmount: 600,
    claimRecommendedAmount: 500, status: "ARCHIVED", paymentHandoffStatus: "PAID",
    archiveAreaOfficeId: originalOffice.id, archiveAreaOfficeName: originalOffice.name,
    archiveCompanyName: "Historical Employer", paidAt: new Date("2026-12-31T23:59:59.000Z"),
    archivedAt: new Date("2026-12-31T23:59:59.000Z"),
  } });
  const activeClaim = await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ANALYTICS-ACTIVE-${suffix}`, claimYear: 2025, claimedAmount: 900,
    claimRecommendedAmount: 700, status: "IN_REVIEW", claimAreaOfficeId: originalOffice.id,
    submittedAt: new Date("2026-02-01T00:00:00.000Z"),
  } });
  await db.workItem.create({ data: { workspaceId: firstWorkspace.id, companyId: company.id,
    reimbursementClaimId: activeClaim.id, assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: officer.id,
    app: "REIMBURSEMENT", kind: "REIMBURSEMENT_CLAIM_REVIEW", status: "OPEN",
    title: "Analytics assignment", targetHref: `/claims/${activeClaim.id}`, sourceKey: `analytics-${suffix}`,
  } });
  await db.reimbursementClaim.create({ data: {
    companyId: otherCompany.id, reference: `ANALYTICS-PRIVATE-${suffix}`, claimYear: 2025, claimedAmount: 99999,
    claimRecommendedAmount: 99999, status: "ARCHIVED", paymentHandoffStatus: "PAID",
    paidAt: new Date("2026-03-01T00:00:00.000Z"), archivedAt: new Date("2026-03-01T00:00:00.000Z"),
  } });

  const report = await getClaimAnalyticsSummary({ ...request, filters: { trainingYears: [2025], yearBasis: "TRAINING" } });
  assert.equal(report.totals.claimCount, 3);
  assert.equal(report.totals.paidCount, 2);
  assert.equal(report.totals.paidGross, "1300.00");
  assert.equal(report.totals.paidNetConfirmed, "725.00");
  assert.equal(report.totals.paidMissingBreakdown, 1);
  assert.equal(report.totals.activeReviewedGross, "700.00");
  assert.equal(report.byAreaOffice.length, 1);
  assert.equal(report.byAreaOffice[0].areaOfficeId, originalOffice.id);
  assert.equal(report.byAreaOffice[0].areaOfficeName, "Original Area");
  assert.equal(report.byYear[0].year, 2025);
  assert.equal(report.byCompany.length, 1);
  assert.equal(report.byCompany[0].companyId, company.id);
  assert.equal(report.byCompany[0].companyName, "Renamed Employer");
  assert.equal(report.byCompany[0].paidNetConfirmed, "725.00");

  const paid = await getClaimAnalyticsSummary({ ...request, filters: { paymentYears: [2026], statuses: ["ARCHIVED"],
    areaOfficeIds: [originalOffice.id], companyIds: [company.id], yearBasis: "PAYMENT" } });
  assert.equal(paid.totals.claimCount, 2);
  assert.equal(paid.byYear[0].year, 2026);
  const otherOfficeReport = await getClaimAnalyticsSummary({ ...request, filters: { areaOfficeIds: [newOffice.id] } });
  assert.equal(otherOfficeReport.totals.claimCount, 0);
  const explicitNone = await getClaimAnalyticsSummary({ ...request, filters: { companyIds: [] } });
  assert.equal(explicitNone.totals.claimCount, 0);
  await assert.rejects(getClaimAnalyticsSummary({ requesterEmail: outsider.email, requesterRole: request.requesterRole }), /active FSD role/);

  const first = await listClaimAnalyticsDetails({ ...request, limit: 2 });
  assert.equal(first.rows.length, 2);
  assert.ok(first.nextCursor);
  assert.ok(first.rows.every((row) => row.companyName === "Historical Employer" || row.companyName === "Renamed Employer"));
  assert.ok(first.rows.every((row) => !Object.keys(row).some((key) => /account|bank|staff/i.test(key))));
  const second = await listClaimAnalyticsDetails({ ...request, limit: 2, afterId: first.nextCursor! });
  assert.equal(second.rows.length, 1);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 3);

  await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ANALYTICS-NOT-ROUTED-${suffix}`, claimYear: 2025, claimedAmount: 300,
    status: "SUBMITTED", claimAreaOfficeId: originalOffice.id,
  } });
  assert.equal((await getClaimAnalyticsSummary(request)).totals.claimCount, 3,
    "HQ RO analytics must not expose a claim before it has reached the role");
  assert.equal((await getClaimAnalyticsSummary(directorRequest)).totals.claimCount, 4);
  const peerClaim = await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ANALYTICS-PEER-${suffix}`, claimYear: 2025, claimedAmount: 350,
    status: "IN_REVIEW", claimAreaOfficeId: originalOffice.id,
  } });
  await db.workItem.create({ data: { workspaceId: firstWorkspace.id, companyId: company.id,
    reimbursementClaimId: peerClaim.id, assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: peer.id,
    app: "REIMBURSEMENT", kind: "REIMBURSEMENT_CLAIM_REVIEW", status: "OPEN",
    title: "Peer analytics assignment", targetHref: `/claims/${peerClaim.id}`, sourceKey: `analytics-peer-${suffix}`,
  } });
  assert.equal((await getClaimAnalyticsSummary(request)).totals.claimCount, 3,
    "a named HQ RO must not see a colleague's assigned claim");
  assert.equal((await getClaimAnalyticsSummary({ requesterEmail: peer.email, requesterRole: request.requesterRole })).totals.claimCount, 3);
  await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ANALYTICS-DRAFT-${suffix}`, claimYear: 2025, claimedAmount: 777777,
    status: "DRAFT",
  } });
  assert.equal((await getClaimAnalyticsSummary(directorRequest)).totals.claimCount, 5,
    "employer drafts must not appear in FSD analytics");

  await db.reimbursementClaim.createMany({ data: Array.from({ length: 1100 }, (_, index) => ({
    companyId: company.id, reference: `ANALYTICS-BULK-${suffix}-${index}`, claimYear: 2025,
    claimedAmount: 1, status: "SUBMITTED" as const,
  })) });
  const ids = new Set<string>();
  let afterId: string | undefined;
  do {
    const page = await listClaimAnalyticsDetails({ ...directorRequest, limit: 500, afterId });
    for (const row of page.rows) ids.add(row.id);
    afterId = page.nextCursor ?? undefined;
  } while (afterId);
  assert.equal(ids.size, 1105, "large reports must page without repeating or omitting claims");
});
