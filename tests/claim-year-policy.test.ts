import assert from "node:assert/strict";
import test from "node:test";

import { getClaimYearFilingError, isLateClaimSubmission } from "../lib/claim-policy";

test("only the immediately preceding training year is claimable", () => {
  assert.equal(getClaimYearFilingError(2026, 2027), null);
  assert.match(getClaimYearFilingError(2027, 2027) ?? "", /first be claimed in 2028/);
  assert.match(getClaimYearFilingError(2025, 2027) ?? "", /Only training held in 2026/);
});

test("the late deadline applies within the claimable year", () => {
  const filingDate = new Date("2027-07-01T12:00:00Z");
  assert.equal(getClaimYearFilingError(2026, 2027), null);
  assert.equal(isLateClaimSubmission(2026, filingDate), true);
  assert.notEqual(getClaimYearFilingError(2025, 2027), null);
});
