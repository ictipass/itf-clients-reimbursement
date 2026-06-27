export type HqComputationTableRowInput = {
  emphasis?: number;
  areaOfTraining: string;
  totalEmployees?: number;
  numberTrained?: number;
  percentTrained?: number;
  maxPercentClaimable?: number;
  percentTrainingContributionAwarded?: number;
  expenditureClaimed?: number;
  remarks?: string;
};

export type HqComputationTableRow = HqComputationTableRowInput & {
  sortOrder: number;
  equivalentAmountOfContribution: number;
  amountAwardedLowerOfContributionOrClaim: number;
};

export type HqComputationTableInput = {
  contributionPaid: number;
  rows: HqComputationTableRowInput[];
};

export type HqComputationTableSummary = {
  fiftyPercentOfContribution: number;
  amountRecommended: number;
  recommendedContributionPercent: number;
  rows: HqComputationTableRow[];
};

export function buildHqComputationTableSummary(input: HqComputationTableInput) {
  if (!Number.isFinite(input.contributionPaid) || input.contributionPaid < 0) {
    throw new Error("Contribution paid must be a valid non-negative amount.");
  }

  const rows = input.rows.map((row, index) => buildHqComputationTableRow(row, index + 1, input.contributionPaid));
  const amountRecommended = roundToTwoDecimals(
    rows.reduce(
      (total, row) => total + row.amountAwardedLowerOfContributionOrClaim,
      0,
    ),
  );

  return {
    fiftyPercentOfContribution: roundToTwoDecimals(input.contributionPaid / 2),
    amountRecommended,
    recommendedContributionPercent:
      input.contributionPaid === 0
        ? 0
        : roundToTwoDecimals((amountRecommended / input.contributionPaid) * 100),
    rows,
  } satisfies HqComputationTableSummary;
}

function buildHqComputationTableRow(
  row: HqComputationTableRowInput,
  sortOrder: number,
  contributionPaid: number,
) {
  const equivalentAmountOfContribution = calculateEquivalentContributionAmount(
    contributionPaid,
    row.percentTrainingContributionAwarded ?? 0,
  );
  const expenditureClaimed = row.expenditureClaimed ?? 0;

  return {
    ...row,
    sortOrder,
    equivalentAmountOfContribution,
    amountAwardedLowerOfContributionOrClaim: Math.min(
      equivalentAmountOfContribution,
      expenditureClaimed,
    ),
  } satisfies HqComputationTableRow;
}

function calculateEquivalentContributionAmount(
  contributionPaid: number,
  awardPercent: number,
) {
  if (!Number.isFinite(awardPercent) || awardPercent < 0) {
    throw new Error("Award percent must be a valid non-negative number.");
  }

  return roundToTwoDecimals((contributionPaid * awardPercent) / 100);
}

function roundToTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
