import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REIMBURSEMENT_POLICY_EDITION,
  formatReimbursementPolicyEdition,
  getReimbursementPolicyDefinition,
  reimbursementPolicyEditions,
  validatePolicyActivation,
} from "../lib/reimbursement-policy";

test("defaults reimbursement policy to the 8th revised edition", () => {
  assert.equal(DEFAULT_REIMBURSEMENT_POLICY_EDITION, "EIGHTH_REVISED");
  assert.deepEqual(reimbursementPolicyEditions, ["EIGHTH_REVISED"]);
  assert.equal(
    formatReimbursementPolicyEdition("EIGHTH_REVISED"),
    "8th Revised Reimbursement Edition",
  );
});

test("current calculator has an explicit, versioned implementation key", () => {
  assert.equal(
    getReimbursementPolicyDefinition("EIGHTH_REVISED").implementationKey,
    "EIGHTH_REVISED_V1",
  );
  assert.throws(() => getReimbursementPolicyDefinition("NINTH_REVISED"), /Unsupported/);
});

test("formal approval can establish the legacy baseline without changing its edition", () => {
  assert.deepEqual(validatePolicyActivation({
    requesterRole: "WORKSPACE_APP_ADMIN",
    edition: "EIGHTH_REVISED",
    currentEdition: "EIGHTH_REVISED",
    lastActivatedEdition: null,
    approvalReference: "ITF/FS/2026/42",
    approvalConfirmed: true,
  }), {
    edition: "EIGHTH_REVISED",
    implementationKey: "EIGHTH_REVISED_V1",
    approvalReference: "ITF/FS/2026/42",
  });
});

test("activation rejects unimplemented editions, unapproved changes and duplicate confirmations", () => {
  const baseline = {
    requesterRole: "SYSTEM_ADMIN",
    edition: "EIGHTH_REVISED",
    currentEdition: "EIGHTH_REVISED" as const,
    lastActivatedEdition: null,
    approvalReference: "ITF/FS/2026/42",
    approvalConfirmed: true,
  };
  assert.throws(() => validatePolicyActivation({ ...baseline, edition: "NINTH_REVISED" }), /Unsupported/);
  assert.throws(() => validatePolicyActivation({ ...baseline, requesterRole: "HEAD_OF_DIVISION" }), /Only an administrator/);
  assert.throws(() => validatePolicyActivation({ ...baseline, approvalReference: "x" }), /formal policy approval reference/);
  assert.throws(() => validatePolicyActivation({ ...baseline, approvalConfirmed: false }), /formal approval/);
  assert.throws(() => validatePolicyActivation({ ...baseline, lastActivatedEdition: "EIGHTH_REVISED" }), /already active/);
});
