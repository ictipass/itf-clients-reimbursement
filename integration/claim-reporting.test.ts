import "../scripts/assert-integration-db";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { combineClaimFinancialFacts, getClaimFinancialFactsByOffice } from "../lib/claim-reporting";
import { getDb } from "../lib/db";
import { getManagementDashboard } from "../lib/management-dashboard";

test("claim reporting separates training year from payment year and reconciles net disbursement", async () => {
  const db = getDb();
  const suffix = randomUUID().replaceAll("-", "");
  const workspace = await db.workspace.create({ data: { name: `Reporting ${suffix}`, slug: `report-${suffix}` } });
  const office = await db.areaOffice.create({ data: { workspaceId: workspace.id, name: "Reporting Area", slug: `report-area-${suffix}` } });
  const otherOffice = await db.areaOffice.create({ data: { workspaceId: workspace.id, name: "Other Reporting Area", slug: `other-report-area-${suffix}` } });
  const organization = await db.organization.create({ data: { workspaceId: workspace.id, name: "Reporting Employer", slug: `report-org-${suffix}` } });
  const company = await db.company.create({ data: { organizationId: organization.id, areaOfficeId: office.id, legalName: "Reporting Employer Ltd" } });
  const otherCompany = await db.company.create({ data: { organizationId: organization.id, areaOfficeId: otherOffice.id, legalName: "Other Reporting Employer Ltd" } });
  const director = await db.user.create({ data: { name: "Reporting Director", email: `report.${suffix}@example.test` } });
  const manager = await db.user.create({ data: { name: "Reporting Manager", email: `manager.${suffix}@example.test`, isManagement: true } });
  await db.membership.create({ data: { userId: manager.id, workspaceId: workspace.id, areaOfficeId: office.id, role: "AREA_MANAGER" } });
  const registration = await db.registrationApplication.create({ data: {
    companyId: company.id, areaOfficeId: office.id, status: "APPROVED", completedAt: new Date("2027-02-01T00:00:00.000Z"),
  } });
  const assessment = await db.registrationContributionAssessment.create({ data: {
    registrationApplicationId: registration.id, companyId: company.id, areaOfficeId: office.id,
    assessedById: director.id, recommendedAmount: 2000, amReleasedAt: new Date("2027-01-01T00:00:00.000Z"),
  } });
  await db.contributionInvoice.create({ data: {
    companyId: company.id, registrationApplicationId: registration.id, contributionAssessmentId: assessment.id,
    issuedById: director.id, invoiceNumber: `REPORT-INVOICE-${suffix}`, amount: 1200,
    status: "PAID", paidAt: new Date("2027-02-01T00:00:00.000Z"),
  } });
  await db.complianceYear.create({ data: {
    companyId: company.id, year: 2026, status: "APPROVED", amountPaid: 500,
  } });

  await db.reimbursementClaim.create({
    data: {
      companyId: company.id, reference: `REPORT-PAID-${suffix}`, claimYear: 2026, claimedAmount: 1000,
      claimRecommendedAmount: 800, paymentWithholdingTax: 50, paymentTaxOffset: 25,
      status: "ARCHIVED", paymentHandoffStatus: "PAID",
      paidAt: new Date("2027-01-01T00:00:00.000Z"), archivedAt: new Date("2027-01-01T00:00:00.000Z"),
    },
  });
  await db.reimbursementClaim.create({
    data: {
      companyId: company.id, reference: `REPORT-LEGACY-${suffix}`, claimYear: 2026, claimedAmount: 600,
      claimRecommendedAmount: 500, status: "ARCHIVED", paymentHandoffStatus: "PAID",
      paidAt: new Date("2027-12-31T23:59:59.000Z"), archivedAt: new Date("2027-12-31T23:59:59.000Z"),
    },
  });
  const approved = await db.reimbursementClaim.create({
    data: {
      companyId: company.id, reference: `REPORT-APPROVED-${suffix}`, claimYear: 2026,
      claimedAmount: 900, claimRecommendedAmount: 700, status: "SUBMITTED",
    },
  });
  await db.reimbursementVoucherSignoff.create({
    data: {
      reimbursementClaimId: approved.id, kind: "PAYMENT_APPROVED", actorId: director.id,
      actorRole: "DIRECTOR_GENERAL", amount: 700,
    },
  });
  await db.reimbursementClaim.create({
    data: {
      companyId: company.id, reference: `REPORT-CORRECTION-${suffix}`, claimYear: 2026,
      claimedAmount: 300, claimRecommendedAmount: 200, status: "CHANGES_REQUESTED",
    },
  });
  await db.reimbursementClaim.create({
    data: {
      companyId: company.id, reference: `REPORT-DRAFT-${suffix}`, claimYear: 2026,
      claimedAmount: 10000, status: "DRAFT",
    },
  });
  await db.reimbursementClaim.create({
    data: {
      companyId: otherCompany.id, reference: `REPORT-OTHER-${suffix}`, claimYear: 2026,
      claimedAmount: 9000, claimRecommendedAmount: 8000, status: "SUBMITTED",
    },
  });

  const byTrainingYear = await getClaimFinancialFactsByOffice({ year: 2026, areaOfficeIds: [office.id] });
  const trainingFacts = byTrainingYear.get(office.id);
  assert.ok(trainingFacts);
  assert.equal(trainingFacts.activeCount, 2);
  assert.equal(trainingFacts.activeClaimed, 1200);
  assert.equal(trainingFacts.activeReviewed, 900);
  assert.equal(trainingFacts.approvedOutstandingGross, 700);
  assert.equal(trainingFacts.paidCount, 0);
  assert.equal(trainingFacts.archivedCount, 0);

  const byPaymentYear = await getClaimFinancialFactsByOffice({ year: 2027, areaOfficeIds: [office.id] });
  const paymentFacts = byPaymentYear.get(office.id);
  assert.ok(paymentFacts);
  assert.equal(paymentFacts.paidCount, 2);
  assert.equal(paymentFacts.paidGross, 1300);
  assert.equal(paymentFacts.paidDeductions, 75);
  assert.equal(paymentFacts.paidNetConfirmed, 725);
  assert.equal(paymentFacts.paidMissingBreakdown, 1);
  assert.equal(paymentFacts.archivedCount, 2);
  assert.equal(paymentFacts.activeCount, 0);
  assert.deepEqual(combineClaimFinancialFacts([...byPaymentYear.values()]), paymentFacts);

  const otherOnly = await getClaimFinancialFactsByOffice({ year: 2026, areaOfficeIds: [otherOffice.id] });
  assert.equal(otherOnly.get(otherOffice.id)?.activeClaimed, 9000);
  assert.equal(otherOnly.get(otherOffice.id)?.paidCount, 0);
  const followingYear = await getClaimFinancialFactsByOffice({ year: 2028, areaOfficeIds: [office.id] });
  assert.equal(followingYear.get(office.id)?.paidCount, 0);

  const paymentDashboard = await getManagementDashboard({
    requesterEmail: manager.email, requesterRole: "AREA_MANAGER", filters: { year: 2027, areaOfficeId: office.id },
  });
  assert.equal(paymentDashboard.headline.claimsPaid, 725);
  assert.equal(paymentDashboard.headline.claimsPaidMissingBreakdown, 1);
  assert.equal(paymentDashboard.headline.registrationRevenue, 1200);
  assert.equal(paymentDashboard.headline.complianceRevenue, 0);
  assert.equal(paymentDashboard.financialBreakdown.find((row) => row.id === office.id)?.claimsPaid, 725);

  const trainingDashboard = await getManagementDashboard({
    requesterEmail: manager.email, requesterRole: "AREA_MANAGER", filters: { year: 2026, areaOfficeId: office.id },
  });
  assert.equal(trainingDashboard.headline.claimsPending, 2);
  assert.equal(trainingDashboard.headline.claimsApprovedOutstanding, 700);
  assert.equal(trainingDashboard.headline.complianceRevenue, 500);
  assert.equal(trainingDashboard.headline.registrationRevenue, 0);
});
