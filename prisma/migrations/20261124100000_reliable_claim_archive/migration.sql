ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "claimAreaOfficeId" TEXT,
  ADD COLUMN "archiveAreaOfficeId" TEXT,
  ADD COLUMN "archiveAreaOfficeName" TEXT,
  ADD COLUMN "archiveCompanyName" TEXT,
  ADD COLUMN "archiveItfEmployerNumber" TEXT,
  ADD COLUMN "archiveVersion" INTEGER;

CREATE INDEX "ReimbursementClaim_archiveAreaOfficeId_status_recordTier_idx"
  ON "ReimbursementClaim"("archiveAreaOfficeId", "status", "recordTier");

-- Legacy snapshots recorded the office name but not its ID. Resolve only unique
-- matches in the same workspace; ambiguous/missing offices remain HQ-only until
-- records staff reconcile them rather than silently assigning a wrong jurisdiction.
UPDATE "ReimbursementClaim"
SET "archiveAreaOfficeName" = "archiveSnapshot"->>'areaOffice',
    "archiveCompanyName" = "archiveSnapshot"->>'companyName',
    "archiveItfEmployerNumber" = "archiveSnapshot"->'claimDetails'->>'itfEmployerNumber',
    "archiveVersion" = CASE WHEN ("archiveSnapshot"->>'version') ~ '^[0-9]+$'
      THEN ("archiveSnapshot"->>'version')::INTEGER ELSE NULL END
WHERE "status" = 'ARCHIVED' AND "archiveSnapshot" IS NOT NULL;

WITH matched_offices AS (
  SELECT rc."id" AS claim_id, MIN(ao."id") AS office_id, COUNT(*) AS match_count
  FROM "ReimbursementClaim" rc
  JOIN "Company" c ON c."id" = rc."companyId"
  JOIN "Organization" org ON org."id" = c."organizationId"
  JOIN "AreaOffice" ao ON ao."workspaceId" = org."workspaceId"
    AND LOWER(ao."name") = LOWER(rc."archiveAreaOfficeName")
  WHERE rc."status" = 'ARCHIVED' AND rc."archiveAreaOfficeName" IS NOT NULL
  GROUP BY rc."id"
)
UPDATE "ReimbursementClaim" rc
SET "archiveAreaOfficeId" = matched_offices.office_id
FROM matched_offices
WHERE rc."id" = matched_offices.claim_id AND matched_offices.match_count = 1;

-- An archived financial packet is immutable. Later explanations belong in the
-- append-only award-note table, not in a rewritten packet.
CREATE FUNCTION reject_archived_claim_change() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Archived reimbursement claims are immutable.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reimbursement_claim_archive_immutable
BEFORE UPDATE OR DELETE ON "ReimbursementClaim"
FOR EACH ROW EXECUTE FUNCTION reject_archived_claim_change();
