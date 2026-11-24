import "../scripts/assert-integration-db";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { getClaimVisibilityWhere } from "../lib/claim-visibility";
import { getDb } from "../lib/db";

test("archived Area Office access follows the submission office and the claim cannot be rewritten", async () => {
  const db = getDb();
  const suffix = randomUUID().replaceAll("-", "");
  const workspace = await db.workspace.create({ data: { name: `Archive ${suffix}`, slug: `archive-${suffix}` } });
  const originalOffice = await db.areaOffice.create({ data: {
    workspaceId: workspace.id, name: "Original Office", slug: `original-${suffix}`,
  } });
  const newOffice = await db.areaOffice.create({ data: {
    workspaceId: workspace.id, name: "New Office", slug: `new-${suffix}`,
  } });
  const organization = await db.organization.create({ data: {
    workspaceId: workspace.id, name: "Archive Employer", slug: `archive-org-${suffix}`,
  } });
  const company = await db.company.create({ data: {
    organizationId: organization.id, legalName: "Current Company Name", areaOfficeId: newOffice.id,
  } });
  const originalOfficer = await db.user.create({ data: { email: `original.${suffix}@example.test`, name: "Original Officer" } });
  const newOfficer = await db.user.create({ data: { email: `new.${suffix}@example.test`, name: "New Officer" } });
  for (const [userId, areaOfficeId] of [[originalOfficer.id, originalOffice.id], [newOfficer.id, newOffice.id]]) {
    await db.membership.create({ data: { userId, areaOfficeId, workspaceId: workspace.id, role: "AREA_MANAGER" } });
  }
  const claim = await db.reimbursementClaim.create({ data: {
    companyId: company.id, reference: `ARCHIVE-${suffix}`, claimedAmount: 1000,
    status: "ARCHIVED", archivedAt: new Date(), claimAreaOfficeId: originalOffice.id,
    archiveAreaOfficeId: originalOffice.id, archiveAreaOfficeName: originalOffice.name,
    archiveCompanyName: "Historical Company Name", archiveVersion: 1,
    archiveSnapshot: { version: 1, archivedAt: new Date().toISOString(), reference: `ARCHIVE-${suffix}`,
      companyName: "Historical Company Name", areaOffice: originalOffice.name,
      signoffs: [], evidence: [], decisions: [] },
  } });
  const originalScope = await getClaimVisibilityWhere({ email: originalOfficer.email, role: "AREA_MANAGER" });
  const newScope = await getClaimVisibilityWhere({ email: newOfficer.email, role: "AREA_MANAGER" });
  assert.ok(await db.reimbursementClaim.findFirst({ where: { id: claim.id, AND: [originalScope] }, select: { id: true } }));
  assert.equal(await db.reimbursementClaim.findFirst({ where: { id: claim.id, AND: [newScope] }, select: { id: true } }), null);
  await assert.rejects(db.reimbursementClaim.update({ where: { id: claim.id }, data: { archiveCompanyName: "Rewritten" } }), /immutable/);
  await assert.rejects(db.reimbursementClaim.delete({ where: { id: claim.id } }), /immutable/);
});
