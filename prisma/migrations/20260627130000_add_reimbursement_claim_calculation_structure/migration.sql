CREATE TYPE "ReimbursementEmployerScale" AS ENUM ('MEDIUM_LARGE', 'SMALL');
CREATE TYPE "ReimbursementAwardArea" AS ENUM (
  'MANAGEMENT',
  'SUPERVISORY',
  'OCCUPATIONAL',
  'SMALL_SCALE_TRAINING',
  'LEARNING_DEVELOPMENT_PERSONNEL',
  'HEALTH_SAFETY_ENVIRONMENT',
  'SIWES',
  'TRAINING_PLAN'
);
CREATE TYPE "ReimbursementClaimLineStage" AS ENUM (
  'EMPLOYER',
  'AREA_OFFICE',
  'HEADQUARTERS',
  'AUDIT'
);

ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "employerScale" "ReimbursementEmployerScale",
  ADD COLUMN "uncappedAwardPercent" DECIMAL(5, 2),
  ADD COLUMN "cappedAwardPercent" DECIMAL(5, 2),
  ADD COLUMN "calculatedAwardAmount" DECIMAL(14, 2);

ALTER TABLE "ReimbursementClaimLine"
  ADD COLUMN "stage" "ReimbursementClaimLineStage" NOT NULL DEFAULT 'EMPLOYER',
  ADD COLUMN "awardArea" "ReimbursementAwardArea",
  ADD COLUMN "sourceLineId" TEXT;

CREATE INDEX "ReimbursementClaimLine_reimbursementClaimId_stage_idx"
  ON "ReimbursementClaimLine"("reimbursementClaimId", "stage");
CREATE INDEX "ReimbursementClaimLine_sourceLineId_idx"
  ON "ReimbursementClaimLine"("sourceLineId");
