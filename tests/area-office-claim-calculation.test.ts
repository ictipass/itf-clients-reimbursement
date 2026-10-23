import assert from "node:assert/strict";
import test from "node:test";

import { applyAreaOfficeVerifiedCounts, getAreaOfficeCalculationBaseline } from "../lib/area-office-claim-calculation";
import { calculateReimbursementAward } from "../lib/reimbursement-calculation";
import { nairaInWords } from "../lib/naira-in-words";

test("Area Office review preserves employer emphasis and recalculates verified counts", () => {
  const baseline = getAreaOfficeCalculationBaseline({
    employerScale: "MEDIUM_LARGE",
    trainingContributionPaid: { toString: () => "100000" },
    lines: [
      { stage: "EMPLOYER", awardArea: "MANAGEMENT", totalWorkforce: 100, totalTrained: 40, emphasisNumber: 1, percentAwarded: null },
      { stage: "EMPLOYER", awardArea: "SUPERVISORY", totalWorkforce: 100, totalTrained: 30, emphasisNumber: 2, percentAwarded: null },
      { stage: "EMPLOYER", awardArea: "OCCUPATIONAL", totalWorkforce: 100, totalTrained: 20, emphasisNumber: 3, percentAwarded: null },
      { stage: "EMPLOYER", awardArea: "SIWES", totalWorkforce: null, totalTrained: 5, emphasisNumber: null, percentAwarded: null },
      { stage: "EMPLOYER", awardArea: "TRAINING_PLAN", totalWorkforce: null, totalTrained: null, emphasisNumber: null, percentAwarded: { toString: () => "1" } },
    ],
  });
  assert.ok(baseline && baseline.employerScale === "MEDIUM_LARGE");
  const reviewed = applyAreaOfficeVerifiedCounts(baseline, {
    managementTrained: 35, supervisoryTrained: 25, occupationalTrained: 10,
    siwesStudentsAccepted: 12, trainingPlanSubmittedPromptly: false,
  });
  assert.equal(reviewed.employerScale, "MEDIUM_LARGE");
  if (reviewed.employerScale !== "MEDIUM_LARGE") return;
  assert.deepEqual(reviewed.emphasisRanks, baseline.emphasisRanks);
  assert.equal(reviewed.trainingAreas.MANAGEMENT.totalTrained, 35);
  assert.equal(reviewed.trainingPlanSubmittedPromptly, false);
  assert.ok(calculateReimbursementAward(reviewed).totalAmountAwarded > 0);
});

test("Area Office verified counts cannot exceed employer workforce", () => {
  const baseline = getAreaOfficeCalculationBaseline({
    employerScale: "SMALL",
    trainingContributionPaid: { toString: () => "1000" },
    lines: [{ stage: "EMPLOYER", awardArea: "SMALL_SCALE_TRAINING", totalWorkforce: 10, totalTrained: 5, emphasisNumber: null, percentAwarded: null }],
  });
  assert.ok(baseline);
  assert.throws(() => applyAreaOfficeVerifiedCounts(baseline, {
    smallTrained: 11, siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: false,
  }), /between 0 and 10/);
});

test("Area Office calculation rejects missing employer schedule", () => {
  assert.equal(getAreaOfficeCalculationBaseline({ employerScale: "MEDIUM_LARGE", trainingContributionPaid: null, lines: [] }), null);
});

test("Form 1B recommendation includes naira and kobo in words", () => {
  assert.equal(nairaInWords(1250.5), "one thousand, two hundred and fifty naira and fifty kobo only");
});
