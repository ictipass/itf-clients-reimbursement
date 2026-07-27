import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REIMBURSEMENT_POLICY_EDITION,
  formatReimbursementPolicyEdition,
  reimbursementPolicyEditions,
} from "../lib/reimbursement-policy";

test("defaults reimbursement policy to the 8th revised edition", () => {
  assert.equal(DEFAULT_REIMBURSEMENT_POLICY_EDITION, "EIGHTH_REVISED");
  assert.deepEqual(reimbursementPolicyEditions, ["EIGHTH_REVISED"]);
  assert.equal(
    formatReimbursementPolicyEdition("EIGHTH_REVISED"),
    "8th Revised Reimbursement Edition",
  );
});
