import "../scripts/assert-integration-db";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { addClaimAwardNote } from "../lib/claim-award-explanation";
import { getClaimVisibilityWhere } from "../lib/claim-visibility";
import { getDb } from "../lib/db";

test("award explanations are scoped to the assigned HQ officer and remain append-only after archive", async () => {
  const db = getDb();
  const suffix = randomUUID().replaceAll("-", "");
  const workspace = await db.workspace.create({ data: { name: `Award ${suffix}`, slug: `award-${suffix}` } });
  const organization = await db.organization.create({ data: { workspaceId: workspace.id, name: "Award Employer", slug: `award-org-${suffix}` } });
  const company = await db.company.create({ data: { organizationId: organization.id, legalName: "Award Employer Ltd" } });
  const hq = await db.user.create({ data: { email: `hq.${suffix}@example.test`, name: "HQ Reviewer" } });
  const otherHq = await db.user.create({ data: { email: `other.${suffix}@example.test`, name: "Other HQ Reviewer" } });
  const head = await db.user.create({ data: { email: `head.${suffix}@example.test`, name: "Head of Division" } });
  for (const [userId, role] of [[hq.id, "HQ_REIMBURSEMENT_OFFICER"], [otherHq.id, "HQ_REIMBURSEMENT_OFFICER"], [head.id, "HEAD_OF_DIVISION"]] as const) {
    await db.membership.create({ data: { userId, role, workspaceId: workspace.id } });
  }
  const claim = await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `AWARD-${suffix}`, claimYear: 2026, claimedAmount: 1000,
    calculatedAwardAmount: 500, claimRecommendedAmount: 400, status: "SUBMITTED", currentDesk: "HQ_REIMBURSEMENT_OFFICER",
  } });
  await db.workItem.create({ data: {
    workspaceId: workspace.id, companyId: company.id, reimbursementClaimId: claim.id,
    assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: hq.id, kind: "REIMBURSEMENT_CLAIM_REVIEW",
    title: "HQ award review", targetHref: `/claims/${claim.id}`, sourceKey: `award-${suffix}`,
  } });
  const snapshotFields = { reimbursementClaimId: claim.id, policyEdition: "EIGHTH_REVISED" as const,
    employerScale: "MEDIUM_LARGE" as const, calculatedByEmail: hq.email, calculationInput: {}, calculationResult: {},
    uncappedAwardPercent: 40, cappedAwardPercent: 40 };
  await db.reimbursementCalculationSnapshot.create({ data: { ...snapshotFields, stage: "AREA_OFFICE", totalAmountAwarded: 450 } });
  const hqSnapshot = await db.reimbursementCalculationSnapshot.create({ data: { ...snapshotFields, stage: "HEADQUARTERS", totalAmountAwarded: 440 } });
  const table = await db.reimbursementComputationTable.create({ data: {
    reimbursementClaimId: claim.id, companyName: company.legalName, contributionPaid: 1000,
    fiftyPercentOfContribution: 500, amountRecommended: 420, status: "PREPARED", source: "HQ_REVIEW",
  } });

  const input = { claimId: claim.id, requesterId: hq.id, requesterEmail: hq.email,
    requesterRole: "HQ_REIMBURSEMENT_OFFICER" as const, kind: "HQ_REVIEW" as const,
    narrative: "Verified attendance and receipts reduced the eligible training expenditure." };
  await assert.rejects(addClaimAwardNote({ ...input, requesterId: otherHq.id, requesterEmail: otherHq.email }), /assigned to another officer/);
  const first = await addClaimAwardNote(input);
  const stored = await db.reimbursementAwardNote.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(stored.sourceCalculationId, hqSnapshot.id);
  assert.equal(stored.sourceTableId, table.id);
  assert.equal(stored.priorAmount?.toString(), "450");
  assert.equal(stored.reviewedAmount?.toString(), "420");
  await assert.rejects(db.reimbursementAwardNote.update({ where: { id: first.id }, data: { narrative: "Rewritten" } }), /append-only/);
  await assert.rejects(db.reimbursementAwardNote.delete({ where: { id: first.id } }), /append-only/);

  await db.reimbursementClaim.update({ where: { id: claim.id }, data: { currentDesk: "HEAD_OF_DIVISION" } });
  await db.workItem.create({ data: {
    workspaceId: workspace.id, companyId: company.id, reimbursementClaimId: claim.id,
    assignedRole: "HEAD_OF_DIVISION", kind: "REIMBURSEMENT_CLAIM_REVIEW", title: "Division award review",
    targetHref: `/claims/${claim.id}`, sourceKey: `award-head-${suffix}`,
  } });
  await addClaimAwardNote({ claimId: claim.id, requesterId: head.id, requesterEmail: head.email,
    requesterRole: "HEAD_OF_DIVISION", kind: "DIVISION_ATTESTATION",
    narrative: "Reviewed the HQ RO explanation and verified the supporting computation." });
  await db.reimbursementClaim.update({ where: { id: claim.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await assert.rejects(addClaimAwardNote(input), /not available at your current desk/);
  await addClaimAwardNote({ claimId: claim.id, requesterId: head.id, requesterEmail: head.email,
    requesterRole: "HEAD_OF_DIVISION", kind: "ARCHIVE_ADDENDUM",
    narrative: "Later file review confirms the original calculation without modifying it." });
  const successorScope = await getClaimVisibilityWhere({ email: otherHq.email, role: "HQ_REIMBURSEMENT_OFFICER" });
  assert.ok(await db.reimbursementClaim.findFirst({ where: { id: claim.id, status: "ARCHIVED", AND: [successorScope] }, select: { id: true } }));
  await addClaimAwardNote({ claimId: claim.id, requesterId: otherHq.id, requesterEmail: otherHq.email,
    requesterRole: "HQ_REIMBURSEMENT_OFFICER", kind: "ARCHIVE_ADDENDUM",
    narrative: "Successor review cites the original HQ calculation and Head attestation." });
  assert.equal(await db.reimbursementAwardNote.count({ where: { reimbursementClaimId: claim.id } }), 4);
});
