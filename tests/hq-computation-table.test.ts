import assert from "node:assert/strict";
import test from "node:test";

import { buildHqComputationTableSummary, isCurrentHqComputationTable } from "../lib/hq-computation-table";

test("builds HQ computation table rows using lower of equivalent contribution or expenditure claimed", () => {
  const summary = buildHqComputationTableSummary({
    contributionPaid: 10_000_000,
    rows: [
      {
        emphasis: 1,
        areaOfTraining: "Management",
        totalEmployees: 20,
        numberTrained: 10,
        percentTrained: 50,
        maxPercentClaimable: 15,
        percentTrainingContributionAwarded: 15,
        expenditureClaimed: 1_200_000,
      },
      {
        emphasis: 2,
        areaOfTraining: "Supervisory",
        totalEmployees: 30,
        numberTrained: 6,
        percentTrained: 20,
        maxPercentClaimable: 5,
        percentTrainingContributionAwarded: 5,
        expenditureClaimed: 800_000,
      },
    ],
  });

  assert.equal(summary.fiftyPercentOfContribution, 5_000_000);
  assert.deepEqual(
    summary.rows.map((row) => [
      row.sortOrder,
      row.equivalentAmountOfContribution,
      row.expenditureClaimed,
      row.amountAwardedLowerOfContributionOrClaim,
    ]),
    [
      [1, 1_500_000, 1_200_000, 1_200_000],
      [2, 500_000, 800_000, 500_000],
    ],
  );
  assert.equal(summary.amountRecommended, 1_700_000);
  assert.equal(summary.recommendedContributionPercent, 17);
});

test("rejects invalid HQ computation table amounts", () => {
  assert.throws(
    () => buildHqComputationTableSummary({ contributionPaid: -1, rows: [] }),
    /Contribution paid must be a valid non-negative amount/,
  );
  assert.throws(
    () =>
      buildHqComputationTableSummary({
        contributionPaid: 1_000_000,
        rows: [
          {
            areaOfTraining: "Management",
            percentTrainingContributionAwarded: -1,
          },
        ],
      }),
    /Award percent must be a valid non-negative number/,
  );
});

test("HQ recommendation respects the 8th edition 50 percent contribution cap", () => {
  const summary = buildHqComputationTableSummary({
    contributionPaid: 1000,
    rows: [
      { areaOfTraining: "Management", percentTrainingContributionAwarded: 40, expenditureClaimed: 1000 },
      { areaOfTraining: "Supervisory", percentTrainingContributionAwarded: 40, expenditureClaimed: 1000 },
    ],
  });
  assert.equal(summary.rows[0].amountAwardedLowerOfContributionOrClaim, 400);
  assert.equal(summary.rows[1].amountAwardedLowerOfContributionOrClaim, 400);
  assert.equal(summary.amountRecommended, 500);
  assert.equal(summary.recommendedContributionPercent, 50);
});

test("rejects expenditure amounts with fractions of a kobo", () => {
  assert.throws(() => buildHqComputationTableSummary({
    contributionPaid: 1000,
    rows: [{ areaOfTraining: "Management", percentTrainingContributionAwarded: 15, expenditureClaimed: 100.001 }],
  }), /at most two decimal places/);
});

test("a returned HQ table must be prepared again after the correction request", () => {
  const calculationCreatedAt = new Date("2026-10-25T09:00:00Z");
  const tableCreatedAt = new Date("2026-10-25T09:10:00Z");
  assert.equal(isCurrentHqComputationTable({ tableCreatedAt, calculationCreatedAt }), true);
  assert.equal(isCurrentHqComputationTable({ tableCreatedAt, calculationCreatedAt, lastCorrectionAt: new Date("2026-10-25T09:20:00Z") }), false);
  assert.equal(isCurrentHqComputationTable({ tableCreatedAt: new Date("2026-10-25T09:25:00Z"), calculationCreatedAt, lastCorrectionAt: new Date("2026-10-25T09:20:00Z") }), true);
});
