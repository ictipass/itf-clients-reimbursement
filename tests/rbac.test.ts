import assert from "node:assert/strict";
import test from "node:test";

import {
  can,
  canManageAnnualCompliance,
  canManageClaimPolicy,
  isItfRole,
  roles,
} from "../lib/rbac";
import { canViewManagementDashboard } from "../lib/management-dashboard";
import { canAccessPath, canUseSection } from "../lib/feature-gates";

test("claim calculation forms are for employers, not claim reviewers", () => {
  assert.equal(canUseSection("EMPLOYER_ADMIN", "claim.calculation.edit"), true);
  assert.equal(canUseSection("AREA_MANAGER", "claim.calculation.edit"), false);
  assert.equal(canUseSection("HEAD_OF_TRAINING", "claim.calculation.edit"), false);
  assert.equal(canUseSection("REIMBURSEMENT_OFFICER", "claim.calculation.edit"), false);
});
import { getVisibleNavGroups } from "../lib/navigation";
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
  assert.equal(canAccessPath("EMPLOYER_VIEWER", "/settings/system"), false);
  assert.equal(canAccessPath("EMPLOYER_VIEWER", "/settings/users"), false);
});

test("workspace administrators can manage the contribution operating model", () => {
  assert.equal(canManageClaimPolicy("SYSTEM_ADMIN"), true);
  assert.equal(canManageClaimPolicy("WORKSPACE_APP_ADMIN"), true);
  assert.equal(canAccessPath("WORKSPACE_APP_ADMIN", "/settings/system"), true);
  assert.equal(canAccessPath("WORKSPACE_APP_ADMIN", "/settings/claims"), true);
  assert.equal(canAccessPath("WORKSPACE_APP_ADMIN", "/settings/operating-model"), true);
  assert.equal(canManageClaimPolicy("EMPLOYER_ADMIN"), false);
});

test("the primary navigation exposes one consolidated settings entry", () => {
  const settingsItems = getVisibleNavGroups("SYSTEM_ADMIN")
    .flatMap((group) => group.items)
    .filter((item) => item.href.startsWith("/settings"));

  assert.deepEqual(
    settingsItems.map(({ href, label }) => ({ href, label })),
    [{ href: "/settings", label: "Settings" }],
  );
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
    "HEAD_ACCOUNTS",
    "HEAD_REIMBURSEMENT_FINANCE",
    "REIMBURSEMENT_ACCOUNTANT",
    "HEAD_PRE_AUDIT",
    "HEAD_EXPENDITURE",
    "EXPENDITURE_ACCOUNTANT",
    "PAYMENT_INITIATOR",
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
