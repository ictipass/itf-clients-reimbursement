import assert from "node:assert/strict";
import test from "node:test";

import { can, canManageAnnualCompliance, isItfRole, roles } from "../lib/rbac";
import { canViewManagementDashboard } from "../lib/management-dashboard";
import { canAccessPath } from "../lib/feature-gates";
import { getTrainingAreas } from "../lib/training-request";

test("employer administrators cannot manage the ITF workspace", () => {
  assert.equal(can("EMPLOYER_ADMIN", "workspace:manage"), false);
});

test("management access is explicitly toggled for Area Office staff", () => {
  assert.equal(canViewManagementDashboard("AREA_MANAGER"), false);
  assert.equal(canViewManagementDashboard("AREA_MANAGER", true), true);
});

test("new headquarters directors have national oversight permissions", () => {
  assert.equal(can("DIRECTOR_GENERAL", "claims:approve"), true);
  assert.equal(
    can("DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE", "compliance:review"),
    true,
  );
  assert.equal(can("DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE", "claims:approve"), false);
  assert.equal(can("DIRECTOR_FSD", "registry:review"), false);
});

test("personal settings are available without workspace administration", () => {
  assert.equal(canAccessPath("EMPLOYER_VIEWER", "/settings"), true);
  assert.equal(canAccessPath("EMPLOYER_VIEWER", "/settings/preferences"), true);
  assert.equal(canAccessPath("EMPLOYER_VIEWER", "/settings/users"), false);
});

test("participant training areas use the approved classifications", () => {
  assert.deepEqual(getTrainingAreas(), [
    "Management",
    "Supervisory",
    "Occupational",
    "Health & Safety",
  ]);
});

test("annual compliance certificate authority remains at HQ", () => {
  assert.equal(canManageAnnualCompliance("AREA_MANAGER"), false);
  assert.equal(canManageAnnualCompliance("HEAD_OF_DIVISION"), false);
  assert.equal(canManageAnnualCompliance("HEAD_INSPECTORATE_COMPLIANCE"), true);
  assert.equal(canManageAnnualCompliance("HQ_REVENUE_ACCOUNTANT"), true);
});

test("post-HQ reimbursement roles are recognized for workflow assignment", () => {
  const postHqRoles = [
    "DIRECTOR_AUDIT",
    "HEAD_REIMBURSEMENT_AUDIT",
    "REIMBURSEMENT_SCHEDULE_AUDITOR",
    "HEAD_BUDGET",
    "BUDGET_OFFICER",
    "PRE_AUDIT_OFFICER",
    "DIRECTOR_FINANCE",
    "HEAD_REIMBURSEMENT_FINANCE",
    "REIMBURSEMENT_ACCOUNTANT",
  ] as const;

  for (const role of postHqRoles) {
    assert.equal(roles.includes(role), true);
    assert.equal(isItfRole(role), true);
    assert.equal(can(role, "company:read"), true);
    assert.equal(can(role, "audit:read"), true);
  }

  assert.equal(can("DIRECTOR_AUDIT", "claims:approve"), true);
  assert.equal(can("DIRECTOR_FINANCE", "claims:approve"), true);
  assert.equal(can("BUDGET_OFFICER", "claims:approve"), false);
  assert.equal(can("REIMBURSEMENT_ACCOUNTANT", "claims:review"), true);
});
