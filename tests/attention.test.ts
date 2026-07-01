import assert from "node:assert/strict";
import test from "node:test";

import { getClaimDeskForRole, isHeadquartersRole } from "../lib/attention";

test("post-HQ reimbursement desks are treated as national attention queues", () => {
  assert.equal(isHeadquartersRole("DIRECTOR_AUDIT"), true);
  assert.equal(isHeadquartersRole("HEAD_REIMBURSEMENT_AUDIT"), true);
  assert.equal(isHeadquartersRole("REIMBURSEMENT_SCHEDULE_AUDITOR"), true);
  assert.equal(isHeadquartersRole("HEAD_BUDGET"), true);
  assert.equal(isHeadquartersRole("BUDGET_OFFICER"), true);
  assert.equal(isHeadquartersRole("PRE_AUDIT_OFFICER"), true);
  assert.equal(isHeadquartersRole("DIRECTOR_FINANCE"), true);
  assert.equal(isHeadquartersRole("HEAD_REIMBURSEMENT_FINANCE"), true);
  assert.equal(isHeadquartersRole("REIMBURSEMENT_ACCOUNTANT"), true);
});

test("claim attention badges follow the claim's current desk role", () => {
  assert.equal(getClaimDeskForRole("DIRECTOR_AUDIT"), "DIRECTOR_AUDIT");
  assert.equal(getClaimDeskForRole("HEAD_REIMBURSEMENT_AUDIT"), "HEAD_REIMBURSEMENT_AUDIT");
  assert.equal(
    getClaimDeskForRole("REIMBURSEMENT_SCHEDULE_AUDITOR"),
    "REIMBURSEMENT_SCHEDULE_AUDITOR",
  );
  assert.equal(getClaimDeskForRole("DIRECTOR_FINANCE"), "DIRECTOR_FINANCE");
  assert.equal(getClaimDeskForRole("EMPLOYER_VIEWER"), null);
});
