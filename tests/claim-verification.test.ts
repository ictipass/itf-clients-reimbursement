import assert from "node:assert/strict";
import test from "node:test";

import {
  formatContributionVerificationSource,
  formatContributionVerificationStatus,
  isContributionVerificationSource,
  isContributionVerificationStatus,
  isContributionVerified,
} from "../lib/claim-verification";

test("labels reimbursement contribution verification state", () => {
  assert.equal(formatContributionVerificationStatus("PENDING"), "Pending verification");
  assert.equal(formatContributionVerificationStatus("VERIFIED"), "Verified");
  assert.equal(formatContributionVerificationSource("EXTERNAL_SYSTEM"), "External verification system");
});

test("validates contribution verification status and source values", () => {
  assert.equal(isContributionVerificationStatus("NEEDS_REVIEW"), true);
  assert.equal(isContributionVerificationStatus("APPROVED"), false);
  assert.equal(isContributionVerificationSource("IN_APP_REVENUE"), true);
  assert.equal(isContributionVerificationSource("REMITA"), false);
});

test("treats only verified contribution claims as verified", () => {
  assert.equal(isContributionVerified("VERIFIED"), true);
  assert.equal(isContributionVerified("PENDING"), false);
});
