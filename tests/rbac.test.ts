import assert from "node:assert/strict";
import test from "node:test";

import { can, canManageAnnualCompliance } from "../lib/rbac";
import { canViewManagementDashboard } from "../lib/management-dashboard";

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
});

test("annual compliance certificate authority remains at HQ", () => {
  assert.equal(canManageAnnualCompliance("AREA_MANAGER"), false);
  assert.equal(canManageAnnualCompliance("HEAD_OF_DIVISION"), true);
  assert.equal(canManageAnnualCompliance("HQ_REVENUE_ACCOUNTANT"), true);
});
