import assert from "node:assert/strict";
import test from "node:test";

import { awardAmountBridge, canWriteAwardNote } from "../lib/claim-award-explanation";

test("award bridge exposes each calculation stage without silently preferring Audit", () => {
  const bridge = awardAmountBridge({
    employerClaimed: 1000, employerCalculated: 500, areaOffice: 450,
    headquarters: 440, hqComputation: 420, audited: 400,
    reconciled: 410, reconciliationConfirmed: false, finalApproved: 410,
  });
  assert.deepEqual(bridge.map(({ label, amount, change }) => [label, amount, change]), [
    ["Employer claimed", 1000, null], ["Employer Form 2 calculation", 500, -500],
    ["Area Office recommendation", 450, -50], ["HQ RO calculation", 440, -10],
    ["HQ computation (verified expenditure limit)", 420, -20], ["Audit recalculation", 400, -20],
    ["Final approved award", 410, 10],
  ]);
  const reconciled = awardAmountBridge({ employerClaimed: 1000, reconciled: 410, reconciliationConfirmed: true });
  assert.equal(reconciled.at(-1)?.label, "FSD-reconciled computation");
  assert.equal(reconciled.at(-1)?.amount, 410);
});

test("only current HQ/Division desks may author explanations; archived addenda are restricted", () => {
  assert.equal(canWriteAwardNote("HQ_REVIEW", "HQ_REIMBURSEMENT_OFFICER", "HQ_REIMBURSEMENT_OFFICER", "SUBMITTED"), true);
  assert.equal(canWriteAwardNote("HQ_REVIEW", "HQ_REIMBURSEMENT_OFFICER", "HEAD_OF_DIVISION", "SUBMITTED"), false);
  assert.equal(canWriteAwardNote("DIVISION_ATTESTATION", "HEAD_OF_DIVISION", "HEAD_OF_DIVISION", "SUBMITTED"), true);
  assert.equal(canWriteAwardNote("DIVISION_ATTESTATION", "SYSTEM_ADMIN", "HEAD_OF_DIVISION", "SUBMITTED"), false);
  assert.equal(canWriteAwardNote("ARCHIVE_ADDENDUM", "HEAD_OF_DIVISION", "REIMBURSEMENT_ACCOUNTANT", "ARCHIVED"), true);
  assert.equal(canWriteAwardNote("ARCHIVE_ADDENDUM", "EMPLOYER_ADMIN", "REIMBURSEMENT_ACCOUNTANT", "ARCHIVED"), false);
});
