import assert from "node:assert/strict";
import test from "node:test";

import {
  claimAssignmentRoutingReasons,
  individuallyAssignedClaimRoles,
  isClaimAssignedToAnotherOfficer,
  isIndividuallyAssignedClaimRole,
  resolveClaimOfficerAssignment,
} from "../lib/claim-officer-assignment";

test("requires a named officer when a claim desk has multiple active officers", () => {
  const officers = [{ id: "one" }, { id: "two" }];
  assert.throws(() => resolveClaimOfficerAssignment(officers, undefined), /Select the officer/);
  assert.throws(() => resolveClaimOfficerAssignment(officers, "outsider"), /not active/);
  assert.equal(resolveClaimOfficerAssignment(officers, "two"), "two");
  assert.equal(resolveClaimOfficerAssignment([{ id: "one" }], undefined), "one");
  assert.throws(() => resolveClaimOfficerAssignment([], undefined), /No active officer/);
});

test("all individually assigned claim desks have a workflow handoff for sender-authorized reassignment", () => {
  for (const role of individuallyAssignedClaimRoles) {
    assert.ok(claimAssignmentRoutingReasons(role).length > 0, `${role} needs a routing reason`);
    assert.equal(isIndividuallyAssignedClaimRole(role), true);
  }
  assert.equal(isIndividuallyAssignedClaimRole("HEAD_OF_TRAINING"), false);
});

test("only the selected officer may act on a named claim assignment", () => {
  assert.equal(isClaimAssignedToAnotherOfficer("officer-1", "officer-1"), false);
  assert.equal(isClaimAssignedToAnotherOfficer("officer-1", "officer-2"), true);
  assert.equal(isClaimAssignedToAnotherOfficer(null, "officer-2"), false);
});
