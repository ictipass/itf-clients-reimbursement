import assert from "node:assert/strict";
import test from "node:test";

import { analyticsWorkspaceIds, normalizeClaimAnalyticsFilters } from "../lib/claim-analytics";

test("FSD analytics require the active user's matching role and workspace membership", () => {
  const memberships = [{ role: "HQ_REIMBURSEMENT_OFFICER" as const, workspaceId: "workspace-a", isActive: true },
    { role: "HQ_REIMBURSEMENT_OFFICER" as const, workspaceId: "workspace-b", isActive: false }];
  assert.deepEqual(analyticsWorkspaceIds("HQ_REIMBURSEMENT_OFFICER", true, memberships), ["workspace-a"]);
  assert.throws(() => analyticsWorkspaceIds("HQ_REIMBURSEMENT_OFFICER", false, memberships), /permission/);
  assert.throws(() => analyticsWorkspaceIds("AREA_MANAGER", true, memberships), /permission/);
  assert.throws(() => analyticsWorkspaceIds("HEAD_OF_DIVISION", true, memberships), /active FSD role/);
});

test("analytics filters reject invalid values and keep an explicit empty selection empty", () => {
  assert.deepEqual(normalizeClaimAnalyticsFilters({ companyIds: [], trainingYears: [], yearBasis: "PAYMENT" }), {
    companyIds: [], areaOfficeIds: undefined, trainingYears: [], submissionYears: undefined,
    paymentYears: undefined, statuses: undefined, policyEditions: undefined, yearBasis: "PAYMENT",
  });
  assert.deepEqual(normalizeClaimAnalyticsFilters({ trainingYears: [2025, 2025], statuses: ["ARCHIVED"] }).trainingYears, [2025]);
  assert.throws(() => normalizeClaimAnalyticsFilters({ trainingYears: [1999] }), /valid training years/);
  assert.throws(() => normalizeClaimAnalyticsFilters({ statuses: ["PAID"] }), /valid claim status/);
  assert.throws(() => normalizeClaimAnalyticsFilters({ policyEditions: ["NINTH_REVISED"] }), /supported policy edition/);
  assert.throws(() => normalizeClaimAnalyticsFilters({ companyIds: Array(51).fill("company") }), /up to 50/);
});
