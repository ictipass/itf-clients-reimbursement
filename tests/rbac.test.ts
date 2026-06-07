import assert from "node:assert/strict";
import test from "node:test";

import { can, canManageAnnualCompliance } from "../lib/rbac";

test("employer administrators cannot manage the ITF workspace", () => {
  assert.equal(can("EMPLOYER_ADMIN", "workspace:manage"), false);
});

test("annual compliance certificate authority remains at HQ", () => {
  assert.equal(canManageAnnualCompliance("AREA_MANAGER"), false);
  assert.equal(canManageAnnualCompliance("HEAD_OF_DIVISION"), true);
  assert.equal(canManageAnnualCompliance("HQ_REVENUE_ACCOUNTANT"), true);
});
