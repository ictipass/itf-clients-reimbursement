import assert from "node:assert/strict";
import test from "node:test";

import { validateIndividualStaffAssignment } from "../lib/user-directory";

test("individual creation accepts a Headquarters role without an Area Office", () => {
  assert.deepEqual(
    validateIndividualStaffAssignment({ officeScope: "HEADQUARTERS", role: "HQ_REIMBURSEMENT_OFFICER" }),
    { officeScope: "HEADQUARTERS", role: "HQ_REIMBURSEMENT_OFFICER", areaOfficeId: undefined },
  );
});

test("individual creation accepts an Area Office role with an office", () => {
  assert.deepEqual(
    validateIndividualStaffAssignment({ officeScope: "AREA_OFFICE", areaOfficeId: "office-1", role: "AREA_MANAGER" }),
    { officeScope: "AREA_OFFICE", areaOfficeId: "office-1", role: "AREA_MANAGER" },
  );
});

test("individual creation rejects missing offices and mismatched roles", () => {
  assert.throws(() => validateIndividualStaffAssignment({ officeScope: "AREA_OFFICE", role: "AREA_MANAGER" }), /Select an active Area Office/);
  assert.throws(() => validateIndividualStaffAssignment({ officeScope: "AREA_OFFICE", areaOfficeId: "office-1", role: "HQ_REIMBURSEMENT_OFFICER" }), /role valid/);
  assert.throws(() => validateIndividualStaffAssignment({ officeScope: "HEADQUARTERS", areaOfficeId: "office-1", role: "SYSTEM_ADMIN" }), /cannot include an Area Office/);
});
