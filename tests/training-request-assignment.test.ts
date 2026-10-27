import assert from "node:assert/strict";
import test from "node:test";

import { resolveTrainingRequestRoAssignment } from "../lib/training-request";

test("a single Area Office RO can receive a Training Approval Request automatically", () => {
  assert.equal(resolveTrainingRequestRoAssignment([{ id: "ro-1" }]), "ro-1");
});

test("multiple Area Office ROs require the HOT to choose one", () => {
  assert.throws(() => resolveTrainingRequestRoAssignment([{ id: "ro-1" }, { id: "ro-2" }]), /Select the Reimbursement Officer/);
  assert.equal(resolveTrainingRequestRoAssignment([{ id: "ro-1" }, { id: "ro-2" }], "ro-2"), "ro-2");
  assert.throws(() => resolveTrainingRequestRoAssignment([{ id: "ro-1" }], "other"), /not active in this Area Office/);
});
