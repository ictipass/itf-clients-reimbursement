import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePercentTrained,
  calculateReimbursementAward,
} from "../lib/reimbursement-calculation";

test("calculates medium and large employer reimbursement using the official Form 2B table", () => {
  const result = calculateReimbursementAward({
    employerScale: "MEDIUM_LARGE",
    trainingContributionPaid: 50_000_000,
    emphasisRanks: {
      MANAGEMENT: 3,
      SUPERVISORY: 2,
      OCCUPATIONAL: 1,
    },
    trainingAreas: {
      MANAGEMENT: { totalStaff: 100, totalTrained: 19 },
      SUPERVISORY: { totalStaff: 100, totalTrained: 30 },
      OCCUPATIONAL: { totalStaff: 100, totalTrained: 51 },
    },
    learningDevelopmentPersonnel: { totalStaff: 100, totalTrained: 12 },
    healthSafetyEnvironment: { totalWorkforce: 100, totalTrained: 42 },
    siwesStudentsAccepted: 23,
    trainingPlanSubmittedPromptly: false,
  });

  assert.deepEqual(
    result.lines.map((line) => [line.area, line.awardPercent, line.amountAwarded]),
    [
      ["MANAGEMENT", 1, 500_000],
      ["SUPERVISORY", 9, 4_500_000],
      ["OCCUPATIONAL", 15, 7_500_000],
      ["LEARNING_DEVELOPMENT_PERSONNEL", 1, 500_000],
      ["HEALTH_SAFETY_ENVIRONMENT", 3, 1_500_000],
      ["SIWES", 1, 500_000],
      ["TRAINING_PLAN", 0, 0],
    ],
  );
  assert.equal(result.uncappedTotalAwardPercent, 30);
  assert.equal(result.cappedTotalAwardPercent, 30);
  assert.equal(result.totalAmountAwarded, 15_000_000);
});

test("calculates the second medium and large employer example from the claims briefing", () => {
  const result = calculateReimbursementAward({
    employerScale: "MEDIUM_LARGE",
    trainingContributionPaid: 35_000_000,
    emphasisRanks: {
      MANAGEMENT: 1,
      SUPERVISORY: 3,
      OCCUPATIONAL: 2,
    },
    trainingAreas: {
      MANAGEMENT: { totalStaff: 100, totalTrained: 7 },
      SUPERVISORY: { totalStaff: 100, totalTrained: 12 },
      OCCUPATIONAL: { totalStaff: 100, totalTrained: 23 },
    },
    learningDevelopmentPersonnel: { totalStaff: 100, totalTrained: 70 },
    healthSafetyEnvironment: { totalWorkforce: 100, totalTrained: 100 },
    siwesStudentsAccepted: 62,
    trainingPlanSubmittedPromptly: true,
  });

  assert.deepEqual(
    result.lines.map((line) => [line.area, line.awardPercent, line.amountAwarded]),
    [
      ["MANAGEMENT", 5, 1_750_000],
      ["SUPERVISORY", 1, 350_000],
      ["OCCUPATIONAL", 5, 1_750_000],
      ["LEARNING_DEVELOPMENT_PERSONNEL", 2, 700_000],
      ["HEALTH_SAFETY_ENVIRONMENT", 6, 2_100_000],
      ["SIWES", 2, 700_000],
      ["TRAINING_PLAN", 1, 350_000],
    ],
  );
  assert.equal(result.uncappedTotalAwardPercent, 22);
  assert.equal(result.cappedTotalAwardPercent, 22);
  assert.equal(result.totalAmountAwarded, 7_700_000);
});

test("uses the small employer scale for training and SIWES awards", () => {
  const result = calculateReimbursementAward({
    employerScale: "SMALL",
    trainingContributionPaid: 1_000_000,
    smallScaleTraining: {
      totalStaff: 100,
      totalTrained: 45,
    },
    siwesStudentsAccepted: 20,
    trainingPlanSubmittedPromptly: false,
  });

  assert.deepEqual(
    result.lines.map((line) => [line.area, line.awardPercent]),
    [
      ["SMALL_SCALE_TRAINING", 48],
      ["SIWES", 2],
      ["TRAINING_PLAN", 0],
    ],
  );
  assert.equal(result.uncappedTotalAwardPercent, 50);
  assert.equal(result.cappedTotalAwardPercent, 50);
  assert.equal(result.totalAmountAwarded, 500_000);
});

test("validates employee percentage and emphasis rank input", () => {
  assert.equal(calculatePercentTrained(12, 50), 24);
  assert.equal(calculatePercentTrained(5, 0), 0);
  assert.throws(() => calculatePercentTrained(-1, 10), /cannot be negative/);
  assert.throws(
    () =>
      calculateReimbursementAward({
        employerScale: "MEDIUM_LARGE",
        trainingContributionPaid: 1_000_000,
        emphasisRanks: {
          MANAGEMENT: 1,
          SUPERVISORY: 1,
          OCCUPATIONAL: 3,
        },
        trainingAreas: {
          MANAGEMENT: { totalStaff: 10, totalTrained: 1 },
          SUPERVISORY: { totalStaff: 10, totalTrained: 1 },
          OCCUPATIONAL: { totalStaff: 10, totalTrained: 1 },
        },
      }),
    /emphasis ranks must be unique/,
  );
});
