import assert from "node:assert/strict";
import test from "node:test";

import { buildHqComputationTableSummary } from "../lib/hq-computation-table";

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
