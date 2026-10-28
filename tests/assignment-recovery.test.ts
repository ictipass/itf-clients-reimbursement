import assert from "node:assert/strict";
import test from "node:test";

import { hasValidAssignment, recoveryTarget } from "../lib/assignment-recovery";

const membership = (role: "REIMBURSEMENT_OFFICER" | "HQ_REIMBURSEMENT_OFFICER", areaOfficeId: string | null) => ({
  isActive: true, role, workspaceId: "workspace", organizationId: "itf", areaOfficeId,
});

test("an Area Office assignment is stranded after its officer moves to another office", () => {
  const input = {
    userActive: true, role: "REIMBURSEMENT_OFFICER" as const, workspaceId: "workspace",
    organizationId: "itf", areaOfficeId: "old-office",
    memberships: [membership("REIMBURSEMENT_OFFICER", "new-office")],
  };
  assert.equal(hasValidAssignment(input), false);
  assert.equal(hasValidAssignment({ ...input, memberships: [membership("REIMBURSEMENT_OFFICER", "old-office")] }), true);
  assert.equal(hasValidAssignment({ ...input, userActive: false, memberships: [membership("REIMBURSEMENT_OFFICER", "old-office")] }), false);
});

test("HQ named assignments require an active matching role in the same workspace", () => {
  const input = {
    userActive: true, role: "HQ_REIMBURSEMENT_OFFICER" as const, workspaceId: "workspace",
    organizationId: "itf", areaOfficeId: "employer-office",
    memberships: [membership("HQ_REIMBURSEMENT_OFFICER", null)],
  };
  assert.equal(hasValidAssignment(input), true);
  assert.equal(hasValidAssignment({ ...input, memberships: [membership("REIMBURSEMENT_OFFICER", "employer-office")] }), false);
});

test("recovery recognizes the three named workflows", () => {
  assert.deepEqual(recoveryTarget({ assignedRole: "REIMBURSEMENT_OFFICER", trainingPlanSubmissionId: "plan", reimbursementClaimId: null, sourceKey: "plan:1" }), { kind: "plan", id: "plan" });
  assert.deepEqual(recoveryTarget({ assignedRole: "REIMBURSEMENT_OFFICER", trainingPlanSubmissionId: null, reimbursementClaimId: null, sourceKey: "training-request:req:reimbursement_officer" }), { kind: "request", id: "req" });
  assert.deepEqual(recoveryTarget({ assignedRole: "HQ_REIMBURSEMENT_OFFICER", trainingPlanSubmissionId: null, reimbursementClaimId: "claim", sourceKey: "claim:1" }), { kind: "claim", id: "claim" });
});
