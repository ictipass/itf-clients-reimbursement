CREATE TYPE "ReimbursementAwardNoteKind" AS ENUM ('HQ_REVIEW', 'DIVISION_ATTESTATION', 'ARCHIVE_ADDENDUM');

CREATE TABLE "ReimbursementAwardNote" (
  "id" TEXT NOT NULL,
  "reimbursementClaimId" TEXT NOT NULL,
  "kind" "ReimbursementAwardNoteKind" NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" "Role" NOT NULL,
  "narrative" TEXT NOT NULL,
  "evidenceDocumentId" TEXT,
  "sourceCalculationId" TEXT,
  "sourceTableId" TEXT,
  "priorAmount" DECIMAL(14,2),
  "reviewedAmount" DECIMAL(14,2),
  "policyEdition" "ReimbursementPolicyEdition" NOT NULL,
  "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReimbursementAwardNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReimbursementAwardNote_reimbursementClaimId_createdAt_idx" ON "ReimbursementAwardNote"("reimbursementClaimId", "createdAt");
CREATE INDEX "ReimbursementAwardNote_actorId_createdAt_idx" ON "ReimbursementAwardNote"("actorId", "createdAt");
ALTER TABLE "ReimbursementAwardNote" ADD CONSTRAINT "ReimbursementAwardNote_reimbursementClaimId_fkey" FOREIGN KEY ("reimbursementClaimId") REFERENCES "ReimbursementClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReimbursementAwardNote" ADD CONSTRAINT "ReimbursementAwardNote_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Notes are a financial audit record. Corrections must be additional rows, even for database operators.
CREATE FUNCTION reject_reimbursement_award_note_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Award explanation notes are append-only; record an attributed addendum instead.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER reimbursement_award_note_immutable
BEFORE UPDATE OR DELETE ON "ReimbursementAwardNote"
FOR EACH ROW EXECUTE FUNCTION reject_reimbursement_award_note_change();
