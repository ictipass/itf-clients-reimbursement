CREATE TABLE "ReimbursementClaimTraining" (
    "id" TEXT NOT NULL,
    "reimbursementClaimId" TEXT NOT NULL,
    "trainingRequestId" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementClaimTraining_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReimbursementClaimTraining" (
    "id",
    "reimbursementClaimId",
    "trainingRequestId",
    "attachedAt"
)
SELECT
    'legacy_' || md5("id" || ':' || "trainingRequestId"),
    "id",
    "trainingRequestId",
    "createdAt"
FROM "ReimbursementClaim"
WHERE "trainingRequestId" IS NOT NULL;

CREATE UNIQUE INDEX "ReimbursementClaimTraining_trainingRequestId_key"
ON "ReimbursementClaimTraining"("trainingRequestId");

CREATE UNIQUE INDEX "ReimbursementClaimTraining_reimbursementClaimId_trainingRequestId_key"
ON "ReimbursementClaimTraining"("reimbursementClaimId", "trainingRequestId");

CREATE INDEX "ReimbursementClaimTraining_reimbursementClaimId_idx"
ON "ReimbursementClaimTraining"("reimbursementClaimId");

ALTER TABLE "ReimbursementClaimTraining"
ADD CONSTRAINT "ReimbursementClaimTraining_reimbursementClaimId_fkey"
FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReimbursementClaimTraining"
ADD CONSTRAINT "ReimbursementClaimTraining_trainingRequestId_fkey"
FOREIGN KEY ("trainingRequestId") REFERENCES "TrainingRequest"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReimbursementClaim"
DROP CONSTRAINT "ReimbursementClaim_trainingRequestId_fkey";

DROP INDEX IF EXISTS "ReimbursementClaim_trainingRequestId_idx";

ALTER TABLE "ReimbursementClaim"
DROP COLUMN "trainingRequestId";
