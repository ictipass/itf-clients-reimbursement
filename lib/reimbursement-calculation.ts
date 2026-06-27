export const reimbursementTrainingEmphasisAreas = [
  "MANAGEMENT",
  "SUPERVISORY",
  "OCCUPATIONAL",
] as const;

export const reimbursementAwardAreas = [
  ...reimbursementTrainingEmphasisAreas,
  "LEARNING_DEVELOPMENT_PERSONNEL",
  "HEALTH_SAFETY_ENVIRONMENT",
  "SIWES",
  "TRAINING_PLAN",
] as const;

export type ReimbursementTrainingEmphasisArea =
  (typeof reimbursementTrainingEmphasisAreas)[number];

export type ReimbursementAwardArea = (typeof reimbursementAwardAreas)[number];

export type ContributingEmployerScale = "MEDIUM_LARGE" | "SMALL";

export type TrainingEmphasisRank = 1 | 2 | 3;

export type ReimbursementLineCalculation = {
  area: ReimbursementAwardArea;
  percentTrained?: number;
  awardPercent: number;
  amountAwarded: number;
};

export type ReimbursementCalculationInput = {
  employerScale: ContributingEmployerScale;
  trainingContributionPaid: number;
  emphasisRanks: Record<ReimbursementTrainingEmphasisArea, TrainingEmphasisRank>;
  trainingAreas: Record<
    ReimbursementTrainingEmphasisArea,
    {
      totalStaff: number;
      totalTrained: number;
    }
  >;
  learningDevelopmentPersonnel?: {
    totalStaff: number;
    totalTrained: number;
  };
  healthSafetyEnvironment?: {
    totalWorkforce: number;
    totalTrained: number;
  };
  siwesStudentsAccepted?: number;
  trainingPlanSubmittedPromptly?: boolean;
};

export type ReimbursementCalculationResult = {
  lines: ReimbursementLineCalculation[];
  uncappedTotalAwardPercent: number;
  cappedTotalAwardPercent: number;
  totalAmountAwarded: number;
};

const MAX_TOTAL_AWARD_PERCENT = 50;

const mediumLargeEmphasisAwards: Array<{
  min: number;
  max?: number;
  awards: Record<TrainingEmphasisRank, number>;
}> = [
  { min: 1, max: 19, awards: { 1: 5, 2: 3, 3: 1 } },
  { min: 20, max: 29, awards: { 1: 7, 2: 5, 3: 3 } },
  { min: 30, max: 39, awards: { 1: 11, 2: 9, 3: 7 } },
  { min: 40, awards: { 1: 15, 2: 13, 3: 11 } },
];

const smallEmployerAwards = [
  { min: 1, max: 10, award: 20 },
  { min: 11, max: 19, award: 30 },
  { min: 20, max: 29, award: 40 },
  { min: 30, award: 48 },
];

export function calculatePercentTrained(totalTrained: number, totalStaff: number) {
  if (!Number.isFinite(totalTrained) || !Number.isFinite(totalStaff)) {
    throw new Error("Training counts must be valid numbers.");
  }

  if (totalTrained < 0 || totalStaff < 0) {
    throw new Error("Training counts cannot be negative.");
  }

  if (totalStaff === 0) {
    return 0;
  }

  return roundToTwoDecimals((totalTrained / totalStaff) * 100);
}

export function calculateReimbursementAward(input: ReimbursementCalculationInput) {
  if (!Number.isFinite(input.trainingContributionPaid) || input.trainingContributionPaid < 0) {
    throw new Error("Training contribution paid must be a valid non-negative amount.");
  }

  assertEmphasisRanks(input.emphasisRanks);

  const lines: ReimbursementLineCalculation[] = [
    ...reimbursementTrainingEmphasisAreas.map((area) => {
      const counts = input.trainingAreas[area];
      const percentTrained = calculatePercentTrained(counts.totalTrained, counts.totalStaff);
      const awardPercent =
        input.employerScale === "SMALL"
          ? getSmallEmployerAwardPercent(percentTrained)
          : getMediumLargeTrainingEmphasisAwardPercent(
              percentTrained,
              input.emphasisRanks[area],
            );

      return buildLine(area, percentTrained, awardPercent, input.trainingContributionPaid);
    }),
    buildLine(
      "LEARNING_DEVELOPMENT_PERSONNEL",
      input.learningDevelopmentPersonnel
        ? calculatePercentTrained(
            input.learningDevelopmentPersonnel.totalTrained,
            input.learningDevelopmentPersonnel.totalStaff,
          )
        : undefined,
      input.learningDevelopmentPersonnel
        ? getLearningDevelopmentAwardPercent(
            calculatePercentTrained(
              input.learningDevelopmentPersonnel.totalTrained,
              input.learningDevelopmentPersonnel.totalStaff,
            ),
          )
        : 0,
      input.trainingContributionPaid,
    ),
    buildLine(
      "HEALTH_SAFETY_ENVIRONMENT",
      input.healthSafetyEnvironment
        ? calculatePercentTrained(
            input.healthSafetyEnvironment.totalTrained,
            input.healthSafetyEnvironment.totalWorkforce,
          )
        : undefined,
      input.healthSafetyEnvironment
        ? getHealthSafetyEnvironmentAwardPercent(
            calculatePercentTrained(
              input.healthSafetyEnvironment.totalTrained,
              input.healthSafetyEnvironment.totalWorkforce,
            ),
          )
        : 0,
      input.trainingContributionPaid,
    ),
    buildLine(
      "SIWES",
      undefined,
      getSiwesAwardPercent(input.siwesStudentsAccepted ?? 0, input.employerScale),
      input.trainingContributionPaid,
    ),
    buildLine(
      "TRAINING_PLAN",
      undefined,
      input.trainingPlanSubmittedPromptly ? 1 : 0,
      input.trainingContributionPaid,
    ),
  ];

  const uncappedTotalAwardPercent = roundToTwoDecimals(
    lines.reduce((total, line) => total + line.awardPercent, 0),
  );
  const cappedTotalAwardPercent = Math.min(
    uncappedTotalAwardPercent,
    MAX_TOTAL_AWARD_PERCENT,
  );

  return {
    lines,
    uncappedTotalAwardPercent,
    cappedTotalAwardPercent,
    totalAmountAwarded: calculateAwardAmount(
      input.trainingContributionPaid,
      cappedTotalAwardPercent,
    ),
  } satisfies ReimbursementCalculationResult;
}

function assertEmphasisRanks(
  ranks: Record<ReimbursementTrainingEmphasisArea, TrainingEmphasisRank>,
) {
  const values = reimbursementTrainingEmphasisAreas.map((area) => ranks[area]);

  if (new Set(values).size !== reimbursementTrainingEmphasisAreas.length) {
    throw new Error("Management, Supervisory, and Occupational emphasis ranks must be unique.");
  }
}

function getMediumLargeTrainingEmphasisAwardPercent(
  percentTrained: number,
  emphasisRank: TrainingEmphasisRank,
) {
  return (
    mediumLargeEmphasisAwards.find(
      (row) => percentTrained >= row.min && (row.max === undefined || percentTrained <= row.max),
    )?.awards[emphasisRank] ?? 0
  );
}

function getSmallEmployerAwardPercent(percentTrained: number) {
  return (
    smallEmployerAwards.find(
      (row) => percentTrained >= row.min && (row.max === undefined || percentTrained <= row.max),
    )?.award ?? 0
  );
}

function getLearningDevelopmentAwardPercent(percentTrained: number) {
  if (percentTrained >= 40) {
    return 2;
  }

  if (percentTrained >= 1) {
    return 1;
  }

  return 0;
}

function getHealthSafetyEnvironmentAwardPercent(percentTrained: number) {
  if (percentTrained >= 100) {
    return 6;
  }

  if (percentTrained >= 71) {
    return 4;
  }

  if (percentTrained >= 41) {
    return 3;
  }

  if (percentTrained >= 1) {
    return 2;
  }

  return 0;
}

function getSiwesAwardPercent(
  studentsAccepted: number,
  employerScale: ContributingEmployerScale,
) {
  if (!Number.isFinite(studentsAccepted) || studentsAccepted < 0) {
    throw new Error("SIWES students accepted must be a valid non-negative number.");
  }

  if (employerScale === "SMALL") {
    if (studentsAccepted >= 11) {
      return 2;
    }

    return studentsAccepted >= 5 ? 1 : 0;
  }

  if (studentsAccepted >= 35) {
    return 2;
  }

  return studentsAccepted >= 15 ? 1 : 0;
}

function buildLine(
  area: ReimbursementAwardArea,
  percentTrained: number | undefined,
  awardPercent: number,
  trainingContributionPaid: number,
) {
  return {
    area,
    percentTrained,
    awardPercent,
    amountAwarded: calculateAwardAmount(trainingContributionPaid, awardPercent),
  };
}

function calculateAwardAmount(trainingContributionPaid: number, awardPercent: number) {
  return roundToTwoDecimals((trainingContributionPaid * awardPercent) / 100);
}

function roundToTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
