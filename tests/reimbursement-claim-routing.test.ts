import assert from "node:assert/strict";
import test from "node:test";

import {
  canRouteClaimFromDesk,
  getClaimIntakeTransitions,
  getClaimPostIntakeTransitions,
} from "../lib/claims";

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
    ],
  );
});

test("only the current desk role can route a reimbursement claim", () => {
  assert.equal(canRouteClaimFromDesk("DIRECTOR_AUDIT", "DIRECTOR_AUDIT"), true);
  assert.equal(canRouteClaimFromDesk("DIRECTOR_FINANCE", "DIRECTOR_AUDIT"), false);
  assert.equal(canRouteClaimFromDesk("SYSTEM_ADMIN", "DIRECTOR_AUDIT"), true);
  assert.equal(canRouteClaimFromDesk("EMPLOYER_SUBMITTER", "COMPANY"), true);
});
