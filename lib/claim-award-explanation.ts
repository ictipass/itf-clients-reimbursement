import { assertClaimActionAssignee } from "@/lib/claim-officer-assignment";
import { getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";
import { isCurrentHqComputationTable } from "@/lib/hq-computation-table";
import type { Role } from "@/lib/rbac";

export type AwardNoteKind = "HQ_REVIEW" | "DIVISION_ATTESTATION" | "ARCHIVE_ADDENDUM";

export function canWriteAwardNote(kind: AwardNoteKind, role: Role, desk: string, status: string) {
  if (kind === "HQ_REVIEW") return role === "HQ_REIMBURSEMENT_OFFICER" && desk === "HQ_REIMBURSEMENT_OFFICER" && status === "SUBMITTED";
  if (kind === "DIVISION_ATTESTATION") return role === "HEAD_OF_DIVISION" && desk === "HEAD_OF_DIVISION" && status === "SUBMITTED";
  return status === "ARCHIVED" && (role === "HQ_REIMBURSEMENT_OFFICER" || role === "HEAD_OF_DIVISION");
}

export function awardAmountBridge(input: {
  employerClaimed: number;
  employerCalculated?: number | null;
  areaOffice?: number | null;
  headquarters?: number | null;
  hqComputation?: number | null;
  audited?: number | null;
  reconciled?: number | null;
  reconciliationConfirmed?: boolean;
  finalApproved?: number | null;
}) {
  const rows: { label: string; amount: number; change: number | null }[] = [];
  const append = (label: string, amount: number | null | undefined) => {
    if (amount == null || !Number.isFinite(amount)) return;
    const preceding = rows.at(-1);
    rows.push({ label, amount, change: preceding ? Math.round((amount - preceding.amount) * 100) / 100 : null });
  };
  append("Employer claimed", input.employerClaimed);
  append("Employer Form 2 calculation", input.employerCalculated);
  append("Area Office recommendation", input.areaOffice);
  append("HQ RO calculation", input.headquarters);
  append("HQ computation (verified expenditure limit)", input.hqComputation);
  append("Audit recalculation", input.audited);
  if (input.reconciliationConfirmed) append("FSD-reconciled computation", input.reconciled);
  append("Final approved award", input.finalApproved);
  return rows;
}

export async function addClaimAwardNote(input: {
  claimId: string;
  requesterId: string;
  requesterEmail: string;
  requesterRole: Role;
  kind: AwardNoteKind;
  narrative: string;
  evidenceDocumentId?: string;
}) {
  const narrative = input.narrative.trim();
  if (narrative.length < 20 || narrative.length > 3000) throw new Error("Write an explanation of 20 to 3,000 characters, including the reason for any amount change.");
  const db = getDb();
  const scope = await getClaimVisibilityWhere({ email: input.requesterEmail, role: input.requesterRole });
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", AND: [scope] },
    select: {
      id: true, currentDesk: true, status: true, policyEdition: true, claimRecommendedAmount: true,
      auditReview: { select: { reconciliationTableId: true } },
      decisions: { where: { reason: { startsWith: "Head of Reimbursement Division returned the claim to" } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      calculationSnapshots: { where: { stage: { in: ["AREA_OFFICE", "HEADQUARTERS"] }, recordTier: "HOT" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, stage: true, totalAmountAwarded: true, createdAt: true } },
      computationTables: { where: { recordTier: "HOT" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, source: true, status: true, amountRecommended: true, createdAt: true } },
      awardNotes: { where: { kind: "HQ_REVIEW" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { sourceCalculationId: true, sourceTableId: true } },
    },
  });
  if (!claim || !canWriteAwardNote(input.kind, input.requesterRole, claim.currentDesk, claim.status)) {
    throw new Error("This award explanation is not available at your current desk.");
  }
  if (input.kind !== "ARCHIVE_ADDENDUM") await assertClaimActionAssignee({ claimId: claim.id, requesterId: input.requesterId });
  const evidenceId = input.evidenceDocumentId?.trim() || null;
  if (evidenceId && !await db.document.findFirst({ where: { id: evidenceId, reimbursementClaimId: claim.id, isActive: true, recordTier: "HOT" }, select: { id: true } })) {
    throw new Error("Select an active evidence document attached to this claim.");
  }
  const hq = claim.calculationSnapshots.find((snapshot) => snapshot.stage === "HEADQUARTERS");
  const area = claim.calculationSnapshots.find((snapshot) => snapshot.stage === "AREA_OFFICE");
  const hqTable = claim.computationTables.find((table) => table.source === "HQ_REVIEW" && table.status !== "DRAFT" && hq && isCurrentHqComputationTable({
    tableCreatedAt: table.createdAt, calculationCreatedAt: hq.createdAt, lastCorrectionAt: claim.decisions[0]?.createdAt,
  }));
  const reconciliation = claim.computationTables.find((table) => table.source === "AUDIT_RECONCILIATION" && table.status !== "DRAFT" && table.id === claim.auditReview?.reconciliationTableId);
  if (input.kind !== "ARCHIVE_ADDENDUM" && (!hq || !hqTable)) throw new Error("Save the HQ calculation and current computation table before explaining the award.");
  if (input.kind === "DIVISION_ATTESTATION" && !claim.awardNotes.some((note) => note.sourceCalculationId === hq?.id && note.sourceTableId === hqTable?.id)) {
    throw new Error("The HQ RO must record a processing explanation for the current calculation before Division attestation.");
  }
  const selectedTable = input.kind === "DIVISION_ATTESTATION" && reconciliation ? reconciliation : hqTable;
  const priorAmount = input.kind === "HQ_REVIEW" ? area?.totalAmountAwarded : hqTable?.amountRecommended;
  const reviewedAmount = input.kind === "ARCHIVE_ADDENDUM" ? claim.claimRecommendedAmount : selectedTable?.amountRecommended;
  const actor = await db.user.findFirst({ where: { id: input.requesterId, email: input.requesterEmail, isActive: true }, select: { id: true } });
  if (!actor) throw new Error("Your staff account is no longer active.");
  return db.reimbursementAwardNote.create({
    data: {
      reimbursementClaimId: claim.id, actorId: actor.id, actorRole: input.requesterRole, kind: input.kind,
      narrative, evidenceDocumentId: evidenceId, sourceCalculationId: hq?.id ?? null, sourceTableId: selectedTable?.id ?? null,
      priorAmount: priorAmount ?? null, reviewedAmount: reviewedAmount ?? null, policyEdition: claim.policyEdition,
    },
    select: { id: true },
  });
}
