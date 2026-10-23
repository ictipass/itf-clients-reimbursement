import type { ReimbursementCalculationInput, TrainingEmphasisRank } from "@/lib/reimbursement-calculation";

type EmployerLine = {
  stage: string;
  awardArea: string | null;
  totalWorkforce: number | null;
  totalTrained: number | null;
  emphasisNumber: number | null;
  percentAwarded: { toString(): string } | null;
};

export type AreaOfficeVerifiedCounts = {
  managementTrained?: number;
  supervisoryTrained?: number;
  occupationalTrained?: number;
  smallTrained?: number;
  ldTrained?: number;
  hseTrained?: number;
  siwesStudentsAccepted: number;
  trainingPlanSubmittedPromptly: boolean;
};

export function getAreaOfficeCalculationBaseline(input: {
  employerScale: "MEDIUM_LARGE" | "SMALL" | null;
  trainingContributionPaid: { toString(): string } | null;
  lines: EmployerLine[];
}): ReimbursementCalculationInput | null {
  const paid = Number(input.trainingContributionPaid?.toString());
  if (!input.employerScale || !input.trainingContributionPaid || !Number.isFinite(paid) || paid < 0) return null;

  const line = (area: string) => input.lines.find((row) => row.stage === "EMPLOYER" && row.awardArea === area);
  const siwes = line("SIWES")?.totalTrained ?? 0;
  const planPrompt = Number(line("TRAINING_PLAN")?.percentAwarded?.toString() ?? 0) > 0;
  const common = {
    trainingContributionPaid: paid,
    siwesStudentsAccepted: siwes,
    trainingPlanSubmittedPromptly: planPrompt,
  };

  if (input.employerScale === "SMALL") {
    const small = line("SMALL_SCALE_TRAINING");
    if (small?.totalWorkforce == null || small.totalTrained == null) return null;
    return {
      ...common,
      employerScale: "SMALL",
      smallScaleTraining: { totalStaff: small.totalWorkforce, totalTrained: small.totalTrained },
    };
  }

  const management = line("MANAGEMENT");
  const supervisory = line("SUPERVISORY");
  const occupational = line("OCCUPATIONAL");
  const core = [management, supervisory, occupational];
  if (core.some((row) => row?.totalWorkforce == null || row.totalTrained == null || ![1, 2, 3].includes(row.emphasisNumber ?? 0))) return null;
  const [m, s, o] = core as [NonNullable<typeof management>, NonNullable<typeof supervisory>, NonNullable<typeof occupational>];
  const ld = line("LEARNING_DEVELOPMENT_PERSONNEL");
  const hse = line("HEALTH_SAFETY_ENVIRONMENT");
  return {
    ...common,
    employerScale: "MEDIUM_LARGE",
    emphasisRanks: {
      MANAGEMENT: m.emphasisNumber as TrainingEmphasisRank,
      SUPERVISORY: s.emphasisNumber as TrainingEmphasisRank,
      OCCUPATIONAL: o.emphasisNumber as TrainingEmphasisRank,
    },
    trainingAreas: {
      MANAGEMENT: { totalStaff: m.totalWorkforce!, totalTrained: m.totalTrained! },
      SUPERVISORY: { totalStaff: s.totalWorkforce!, totalTrained: s.totalTrained! },
      OCCUPATIONAL: { totalStaff: o.totalWorkforce!, totalTrained: o.totalTrained! },
    },
    learningDevelopmentPersonnel: ld?.totalWorkforce != null && ld.totalTrained != null
      ? { totalStaff: ld.totalWorkforce, totalTrained: ld.totalTrained } : undefined,
    healthSafetyEnvironment: hse?.totalWorkforce != null && hse.totalTrained != null
      ? { totalWorkforce: hse.totalWorkforce, totalTrained: hse.totalTrained } : undefined,
  };
}

function checkedCount(value: number | undefined, maximum: number, label: string) {
  if (value === undefined || !Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a whole number between 0 and ${maximum}.`);
  }
  return value;
}

export function applyAreaOfficeVerifiedCounts(
  baseline: ReimbursementCalculationInput,
  verified: AreaOfficeVerifiedCounts,
): ReimbursementCalculationInput {
  if (!Number.isInteger(verified.siwesStudentsAccepted) || verified.siwesStudentsAccepted < 0) {
    throw new Error("Verified SIWES students must be a non-negative whole number.");
  }
  const common = {
    siwesStudentsAccepted: verified.siwesStudentsAccepted,
    trainingPlanSubmittedPromptly: verified.trainingPlanSubmittedPromptly,
  };
  if (baseline.employerScale === "SMALL") {
    return {
      ...baseline, ...common,
      smallScaleTraining: {
        ...baseline.smallScaleTraining,
        totalTrained: checkedCount(verified.smallTrained, baseline.smallScaleTraining.totalStaff, "Verified small-scale trainees"),
      },
    };
  }
  return {
    ...baseline, ...common,
    trainingAreas: {
      MANAGEMENT: { ...baseline.trainingAreas.MANAGEMENT, totalTrained: checkedCount(verified.managementTrained, baseline.trainingAreas.MANAGEMENT.totalStaff, "Verified management trainees") },
      SUPERVISORY: { ...baseline.trainingAreas.SUPERVISORY, totalTrained: checkedCount(verified.supervisoryTrained, baseline.trainingAreas.SUPERVISORY.totalStaff, "Verified supervisory trainees") },
      OCCUPATIONAL: { ...baseline.trainingAreas.OCCUPATIONAL, totalTrained: checkedCount(verified.occupationalTrained, baseline.trainingAreas.OCCUPATIONAL.totalStaff, "Verified occupational trainees") },
    },
    learningDevelopmentPersonnel: baseline.learningDevelopmentPersonnel ? {
      ...baseline.learningDevelopmentPersonnel,
      totalTrained: checkedCount(verified.ldTrained, baseline.learningDevelopmentPersonnel.totalStaff, "Verified L&D trainees"),
    } : undefined,
    healthSafetyEnvironment: baseline.healthSafetyEnvironment ? {
      ...baseline.healthSafetyEnvironment,
      totalTrained: checkedCount(verified.hseTrained, baseline.healthSafetyEnvironment.totalWorkforce, "Verified HSE trainees"),
    } : undefined,
  };
}
