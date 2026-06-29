import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REVENUE_WORKFLOW_MODE,
  formatRevenueWorkflowMode,
  revenueWorkflowModes,
  usesInAppRevenueWorkflow,
} from "../lib/revenue-workflow";

test("defaults revenue workflow to external verification mode", () => {
  assert.equal(DEFAULT_REVENUE_WORKFLOW_MODE, "EXTERNAL_VERIFICATION");
  assert.deepEqual(revenueWorkflowModes, ["EXTERNAL_VERIFICATION", "IN_APP_REVENUE"]);
  assert.equal(
    formatRevenueWorkflowMode("EXTERNAL_VERIFICATION"),
    "External verification / reimbursement-only",
  );
  assert.equal(usesInAppRevenueWorkflow("EXTERNAL_VERIFICATION"), false);
  assert.equal(usesInAppRevenueWorkflow("IN_APP_REVENUE"), true);
});
