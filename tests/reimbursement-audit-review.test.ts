import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReimbursementAuditReviewStatus,
  isReimbursementAuditReviewStatus,
} from "../lib/reimbursement-audit-review";
import { canSetClaimAuditStatus, canSetPaymentFileAuditStatus, calculateAuditorClaim, requiredAuditForClaimHandoff, updateClaimRecommendation } from "../lib/claims";

test("formats and validates reimbursement audit review statuses", () => {
  assert.equal(formatReimbursementAuditReviewStatus("SUBMITTED"), "Submitted");
  assert.equal(formatReimbursementAuditReviewStatus("CLEARED"), "Cleared");
  assert.equal(isReimbursementAuditReviewStatus("VERIFIED"), true);
  assert.equal(isReimbursementAuditReviewStatus("APPROVED"), false);
});

test("claim audit decisions follow the Schedule Auditor, Head Audit, and Director Audit desks", () => {
  assert.equal(canSetClaimAuditStatus({ role: "REIMBURSEMENT_SCHEDULE_AUDITOR", desk: "REIMBURSEMENT_SCHEDULE_AUDITOR", nextStatus: "SUBMITTED" }), true);
  assert.equal(canSetClaimAuditStatus({ role: "HEAD_REIMBURSEMENT_AUDIT", desk: "HEAD_REIMBURSEMENT_AUDIT", currentStatus: "SUBMITTED", nextStatus: "VERIFIED" }), true);
  assert.equal(canSetClaimAuditStatus({ role: "DIRECTOR_AUDIT", desk: "DIRECTOR_AUDIT", currentStatus: "VERIFIED", nextStatus: "CLEARED" }), true);
  assert.equal(canSetClaimAuditStatus({ role: "DIRECTOR_AUDIT", desk: "DIRECTOR_AUDIT", currentStatus: "SUBMITTED", nextStatus: "CLEARED" }), false);
  assert.equal(canSetClaimAuditStatus({ role: "REIMBURSEMENT_SCHEDULE_AUDITOR", desk: "DIRECTOR_AUDIT", currentStatus: "VERIFIED", nextStatus: "CLEARED" }), false);
});

test("payment-file pre-audit is a separate two-desk review", () => {
  assert.equal(canSetPaymentFileAuditStatus({ role: "PRE_AUDIT_OFFICER", desk: "PRE_AUDIT_OFFICER", nextStatus: "SUBMITTED" }), true);
  assert.equal(canSetPaymentFileAuditStatus({ role: "HEAD_PRE_AUDIT", desk: "HEAD_PRE_AUDIT", currentStatus: "SUBMITTED", nextStatus: "VERIFIED" }), true);
  assert.equal(canSetPaymentFileAuditStatus({ role: "HEAD_PRE_AUDIT", desk: "HEAD_PRE_AUDIT", currentStatus: "DRAFT", nextStatus: "VERIFIED" }), false);
  assert.equal(canSetPaymentFileAuditStatus({ role: "DIRECTOR_AUDIT", desk: "HEAD_PRE_AUDIT", currentStatus: "SUBMITTED", nextStatus: "VERIFIED" }), false);
});

test("routing gates use the correct review and decision stage", () => {
  assert.deepEqual(requiredAuditForClaimHandoff("REIMBURSEMENT_SCHEDULE_AUDITOR", "HEAD_REIMBURSEMENT_AUDIT"), { kind: "CLAIM", status: "SUBMITTED" });
  assert.deepEqual(requiredAuditForClaimHandoff("HEAD_REIMBURSEMENT_AUDIT", "DIRECTOR_AUDIT"), { kind: "CLAIM", status: "VERIFIED" });
  assert.deepEqual(requiredAuditForClaimHandoff("DIRECTOR_AUDIT", "DIRECTOR_GENERAL"), { kind: "CLAIM", status: "CLEARED" });
  assert.deepEqual(requiredAuditForClaimHandoff("PRE_AUDIT_OFFICER", "HEAD_PRE_AUDIT"), { kind: "PAYMENT_FILE", status: "SUBMITTED" });
  assert.deepEqual(requiredAuditForClaimHandoff("HEAD_PRE_AUDIT", "HEAD_REIMBURSEMENT_FINANCE"), { kind: "PAYMENT_FILE", status: "VERIFIED" });
  assert.equal(requiredAuditForClaimHandoff("DIRECTOR_AUDIT", "HEAD_PRE_AUDIT"), null);
});

test("only the Schedule Auditor can invoke the optional fourth calculation", async () => {
  await assert.rejects(calculateAuditorClaim({
    claimId: "claim-1", requesterEmail: "hq.ro@example.test", requesterRole: "HQ_REIMBURSEMENT_OFFICER",
    verified: { siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: false },
    reviewerRemarks: "Discrepancy", reviewedForm1A: true, reviewedForm2A: true, reviewedEvidence: true,
  }), /Only the Reimbursement Schedule Auditor/);
});

test("audit officers cannot manually override the policy-calculated Form 1B amount", async () => {
  await assert.rejects(updateClaimRecommendation({
    claimId: "claim-1", requesterEmail: "auditor@example.test", requesterRole: "REIMBURSEMENT_SCHEDULE_AUDITOR",
    claimRecommendedAmount: 100,
  }), /Form 1B amounts are determined/);
});
