import assert from "node:assert/strict";
import test from "node:test";

import { assessAnnualEligibility } from "../lib/annual-eligibility";

test("eligibility requires settled payment, positive amount, and issued certificate", () => {
  const eligible = {
    itfEmployerNumber: "ITF-123",
    year: 2025,
    paymentSettled: true,
    contributionPaid: 100000,
    certificateIssued: true,
    certificateNumber: "COC-2025-123",
  };
  assert.equal(assessAnnualEligibility(eligible).status, "ELIGIBLE");
  assert.equal(assessAnnualEligibility({ ...eligible, paymentSettled: false }).status, "INELIGIBLE");
  assert.equal(assessAnnualEligibility({ ...eligible, contributionPaid: 0 }).status, "INELIGIBLE");
  assert.equal(assessAnnualEligibility({ ...eligible, certificateIssued: false }).status, "INELIGIBLE");
  assert.equal(assessAnnualEligibility({ ...eligible, certificateNumber: null }).status, "INELIGIBLE");
});
