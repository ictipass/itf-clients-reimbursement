import assert from "node:assert/strict";
import test from "node:test";

import { auditVarianceAmount, hasAuditVariance, reviewedClaimAmount } from "../lib/claim-audit-reconciliation";

test("audit variance uses currency precision", () => {
  assert.equal(auditVarianceAmount(7500, 7499.999), 0);
  assert.equal(auditVarianceAmount(7500, 7400), -100);
  assert.equal(hasAuditVariance("0.004"), false);
  assert.equal(hasAuditVariance("0.01"), true);
});

test("a differing audit calculation cannot silently replace the FSD recommendation", () => {
  assert.equal(reviewedClaimAmount({ hqRecommendation: 7500, auditVariance: 0 }), 7500);
  assert.throws(() => reviewedClaimAmount({ hqRecommendation: 7500, auditVariance: -100,
    reconciledRecommendation: 7400 }), /must confirm a revised computation table/);
  assert.equal(reviewedClaimAmount({ hqRecommendation: 7500, auditVariance: -100,
    reconciledRecommendation: 7350, reconciliationConfirmed: true }), 7350);
});
