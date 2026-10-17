import assert from "node:assert/strict";
import test from "node:test";

import { getClaimDeskForRole, getModuleForWorkItem, isHeadquartersRole } from "../lib/attention";
import { getVisibleNavGroups } from "../lib/navigation";

test("jurisdiction requests and registry have separate attention badges", () => {
  const items = getVisibleNavGroups("SYSTEM_ADMIN").flatMap((group) => group.items);
  assert.equal(items.find((item) => item.href === "/jurisdiction-requests")?.module, "jurisdiction");
  assert.equal(items.find((item) => item.href === "/registry")?.module, "registry");
  assert.equal(getModuleForWorkItem("JURISDICTION_CHANGE_REVIEW", "/jurisdiction-requests"), "jurisdiction");
  assert.equal(getModuleForWorkItem("REGISTRATION_REVIEW", "/registry/company-1"), "registry");
  assert.equal(getModuleForWorkItem("REGISTRATION_REVIEW", "/jurisdiction-requests"), "jurisdiction");
});

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
