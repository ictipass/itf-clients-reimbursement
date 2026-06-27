import assert from "node:assert/strict";
import test from "node:test";

import { getClaimIntakeTransitions } from "../lib/claims";

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
