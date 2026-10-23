import assert from "node:assert/strict";
import test from "node:test";

import {
  addClaimLine,
  canRouteClaimFromDesk,
  getClaimIntakeTransitions,
  getClaimPostIntakeTransitions,
} from "../lib/claims";

test("staff cannot create employer claim calculation rows through the service", async () => {
  await assert.rejects(addClaimLine({
    claimId: "claim-1",
    requesterEmail: "area.manager@example.test",
    requesterRole: "AREA_MANAGER",
    trainingArea: "Management",
  }), /Only employers can edit claim calculations/);
});

test("routes reimbursement claim intake through AM, HOT, then A/O reimbursement officer", () => {
  const transitions = getClaimIntakeTransitions();

  assert.deepEqual(
    transitions.map((transition) => [
      transition.from,
      transition.to,
      transition.assignedRole,
    ]),
    [
      ["COMPANY", "AREA_MANAGER", "AREA_MANAGER"],
      ["AREA_MANAGER", "HEAD_OF_TRAINING", "HEAD_OF_TRAINING"],
      ["HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER", "REIMBURSEMENT_OFFICER"],
    ],
  );
});

test("routes processed reimbursement claims through HQ, audit, and finance desks", () => {
  const transitions = getClaimPostIntakeTransitions();

  assert.deepEqual(
    transitions.map((transition) => [
      transition.from,
      transition.to,
      transition.assignedRole,
    ]),
    [
      ["REIMBURSEMENT_OFFICER", "HEAD_OF_TRAINING", "HEAD_OF_TRAINING"],
      ["HEAD_OF_TRAINING", "AREA_MANAGER", "AREA_MANAGER"],
      ["AREA_MANAGER", "DIRECTOR_FSD", "DIRECTOR_FSD"],
      ["DIRECTOR_FSD", "HEAD_OF_DIVISION", "HEAD_OF_DIVISION"],
      ["HEAD_OF_DIVISION", "HQ_REIMBURSEMENT_OFFICER", "HQ_REIMBURSEMENT_OFFICER"],
      ["HQ_REIMBURSEMENT_OFFICER", "HEAD_OF_DIVISION", "HEAD_OF_DIVISION"],
      ["HEAD_OF_DIVISION", "DIRECTOR_FSD", "DIRECTOR_FSD"],
      ["DIRECTOR_FSD", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
      ["DIRECTOR_AUDIT", "HEAD_REIMBURSEMENT_AUDIT", "HEAD_REIMBURSEMENT_AUDIT"],
      [
        "HEAD_REIMBURSEMENT_AUDIT",
        "REIMBURSEMENT_SCHEDULE_AUDITOR",
        "REIMBURSEMENT_SCHEDULE_AUDITOR",
      ],
      [
        "REIMBURSEMENT_SCHEDULE_AUDITOR",
        "HEAD_REIMBURSEMENT_AUDIT",
        "HEAD_REIMBURSEMENT_AUDIT",
      ],
      ["HEAD_REIMBURSEMENT_AUDIT", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
      ["DIRECTOR_AUDIT", "DIRECTOR_FINANCE", "DIRECTOR_FINANCE"],
      ["DIRECTOR_FINANCE", "HEAD_REIMBURSEMENT_FINANCE", "HEAD_REIMBURSEMENT_FINANCE"],
      [
        "HEAD_REIMBURSEMENT_FINANCE",
        "REIMBURSEMENT_ACCOUNTANT",
        "REIMBURSEMENT_ACCOUNTANT",
      ],
      ["REIMBURSEMENT_ACCOUNTANT", "HEAD_BUDGET", "HEAD_BUDGET"],
      ["HEAD_BUDGET", "BUDGET_OFFICER", "BUDGET_OFFICER"],
      ["BUDGET_OFFICER", "HEAD_BUDGET", "HEAD_BUDGET"],
      ["HEAD_BUDGET", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
      ["DIRECTOR_AUDIT", "PRE_AUDIT_OFFICER", "PRE_AUDIT_OFFICER"],
      ["PRE_AUDIT_OFFICER", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
    ],
  );
});

test("only the current desk role can route a reimbursement claim", () => {
  assert.equal(canRouteClaimFromDesk("DIRECTOR_AUDIT", "DIRECTOR_AUDIT"), true);
  assert.equal(canRouteClaimFromDesk("DIRECTOR_FINANCE", "DIRECTOR_AUDIT"), false);
  assert.equal(canRouteClaimFromDesk("HEAD_BUDGET", "HEAD_BUDGET"), true);
  assert.equal(canRouteClaimFromDesk("BUDGET_OFFICER", "HEAD_BUDGET"), false);
  assert.equal(canRouteClaimFromDesk("PRE_AUDIT_OFFICER", "PRE_AUDIT_OFFICER"), true);
  assert.equal(canRouteClaimFromDesk("SYSTEM_ADMIN", "DIRECTOR_AUDIT"), true);
  assert.equal(canRouteClaimFromDesk("EMPLOYER_SUBMITTER", "COMPANY"), true);
});
