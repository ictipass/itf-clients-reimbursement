import assert from "node:assert/strict";
import test from "node:test";

import { getAppNameForMode } from "../lib/domain";
import {
  DEFAULT_REVENUE_WORKFLOW_MODE,
  formatRevenueWorkflowMode,
  revenueWorkflowModes,
  usesInAppRevenueWorkflow,
} from "../lib/revenue-workflow";
import { getVisibleNavGroups } from "../lib/navigation";

test("defaults revenue workflow to external verification mode", () => {
  assert.equal(DEFAULT_REVENUE_WORKFLOW_MODE, "EXTERNAL_VERIFICATION");
  assert.deepEqual(revenueWorkflowModes, ["EXTERNAL_VERIFICATION", "IN_APP_REVENUE"]);
  assert.equal(
    formatRevenueWorkflowMode("EXTERNAL_VERIFICATION"),
    "Reimbursement",
  );
  assert.equal(usesInAppRevenueWorkflow("EXTERNAL_VERIFICATION"), false);
  assert.equal(usesInAppRevenueWorkflow("IN_APP_REVENUE"), true);
});

test("reimbursement navigation omits the in-app compliance desk", () => {
  const reimbursementLinks = getVisibleNavGroups("SYSTEM_ADMIN", "EXTERNAL_VERIFICATION")
    .flatMap((group) => group.items.map((item) => item.href));
  const integratedLinks = getVisibleNavGroups("SYSTEM_ADMIN", "IN_APP_REVENUE")
    .flatMap((group) => group.items.map((item) => item.href));

  assert.equal(reimbursementLinks.includes("/compliance"), false);
  assert.equal(integratedLinks.includes("/compliance"), true);
});

test("application name follows the selected operating mode", () => {
  assert.equal(getAppNameForMode("EXTERNAL_VERIFICATION"), "ITF Reimbursement Platform");
  assert.equal(
    getAppNameForMode("IN_APP_REVENUE"),
    "ITF Integrated Contribution and Reimbursement Platform",
  );
});
