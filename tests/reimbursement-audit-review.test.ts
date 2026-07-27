import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReimbursementAuditReviewStatus,
  isReimbursementAuditReviewStatus,
} from "../lib/reimbursement-audit-review";

test("formats and validates reimbursement audit review statuses", () => {
  assert.equal(formatReimbursementAuditReviewStatus("SUBMITTED"), "Submitted");
  assert.equal(formatReimbursementAuditReviewStatus("CLEARED"), "Cleared");
  assert.equal(isReimbursementAuditReviewStatus("VERIFIED"), true);
  assert.equal(isReimbursementAuditReviewStatus("APPROVED"), false);
});
