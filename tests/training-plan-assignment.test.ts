import assert from "node:assert/strict";
import test from "node:test";

import { resolveTrainingPlanOfficerAssignment } from "../lib/training-plan";

test("a single Area Office RO is selected automatically", () => {
  assert.equal(resolveTrainingPlanOfficerAssignment([{ id: "ro-1" }]), "ro-1");
});

test("multiple Area Office ROs require an explicit choice", () => {
  assert.throws(() => resolveTrainingPlanOfficerAssignment([{ id: "ro-1" }, { id: "ro-2" }]), /Select the Reimbursement Officer/);
  assert.equal(resolveTrainingPlanOfficerAssignment([{ id: "ro-1" }, { id: "ro-2" }], "ro-2"), "ro-2");
  assert.throws(() => resolveTrainingPlanOfficerAssignment([{ id: "ro-1" }], "other"), /not active in this Area Office/);
});
