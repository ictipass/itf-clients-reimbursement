import assert from "node:assert/strict";
import test from "node:test";

import { combineClaimFinancialFacts, emptyClaimFinancialFacts, getClaimFinancialFactsByOffice } from "../lib/claim-reporting";

test("combines scoped claim financial facts without inventing missing amounts", () => {
  const first = { ...emptyClaimFinancialFacts(), paidCount: 2, paidGross: 1300, paidDeductions: 75,
    paidNetConfirmed: 725, paidMissingBreakdown: 1, archivedCount: 2 };
  const second = { ...emptyClaimFinancialFacts(), activeCount: 1, activeClaimed: 900,
    activeReviewed: 700, approvedOutstandingGross: 700 };
  assert.deepEqual(combineClaimFinancialFacts([first, second]), {
    paidCount: 2, paidGross: 1300, paidDeductions: 75, paidNetConfirmed: 725,
    paidMissingBreakdown: 1, archivedCount: 2, activeCount: 1,
    activeClaimed: 900, activeReviewed: 700, approvedOutstandingGross: 700,
  });
  assert.deepEqual(combineClaimFinancialFacts([]), emptyClaimFinancialFacts());
});

test("rejects invalid reporting years before connecting to the database", async () => {
  await assert.rejects(getClaimFinancialFactsByOffice({ year: 1999 }), /valid reporting year/);
  await assert.rejects(getClaimFinancialFactsByOffice({ year: 2027.5 }), /valid reporting year/);
});
