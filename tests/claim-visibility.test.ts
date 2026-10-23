import assert from "node:assert/strict";
import test from "node:test";

import { buildClaimVisibilityWhere, canBrowseArchivedClaims } from "../lib/claim-visibility";

const workspaceId = "workspace-1";

test("HQ RO only sees packets routed to the HQ RO desk in their workspace", () => {
  assert.deepEqual(buildClaimVisibilityWhere("HQ_REIMBURSEMENT_OFFICER", [{
    role: "HQ_REIMBURSEMENT_OFFICER", workspaceId, organizationId: "itf-hq", areaOfficeId: null,
  }]), {
    company: { organization: { workspaceId: { in: [workspaceId] } } },
    OR: [
      { workItems: { some: { assignedRole: "HQ_REIMBURSEMENT_OFFICER", app: "REIMBURSEMENT", recordTier: "HOT" } } },
      { status: "ARCHIVED" },
    ],
  });
});

test("Head of Division has a separate packet assignment from HQ RO", () => {
  const where = buildClaimVisibilityWhere("HEAD_OF_DIVISION", [{
    role: "HEAD_OF_DIVISION", workspaceId, organizationId: "itf-hq", areaOfficeId: null,
  }]);
  assert.deepEqual(where.OR, [
    { workItems: { some: { assignedRole: "HEAD_OF_DIVISION", app: "REIMBURSEMENT", recordTier: "HOT" } } },
    { status: "ARCHIVED" },
  ]);
});

test("Area Office access also requires the assigned office and role", () => {
  const where = buildClaimVisibilityWhere("REIMBURSEMENT_OFFICER", [{
    role: "REIMBURSEMENT_OFFICER", workspaceId, organizationId: "itf-office", areaOfficeId: "area-1",
  }]);
  assert.deepEqual(where.company, { organization: { workspaceId: { in: [workspaceId] } }, areaOfficeId: { in: ["area-1"] } });
  assert.deepEqual(buildClaimVisibilityWhere("REIMBURSEMENT_OFFICER", []), { id: { in: [] } });
});

test("employers see only their own organization's claims", () => {
  assert.deepEqual(buildClaimVisibilityWhere("EMPLOYER_SUBMITTER", [{
    role: "EMPLOYER_SUBMITTER", workspaceId, organizationId: "employer-1", areaOfficeId: null,
  }]), { company: { organizationId: { in: ["employer-1"] } } });
});

test("archive browse is limited to the designated HQ and jurisdiction roles", () => {
  for (const role of ["DIRECTOR_FSD", "HEAD_OF_DIVISION", "HQ_REIMBURSEMENT_OFFICER", "AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"] as const) {
    assert.equal(canBrowseArchivedClaims(role), true);
  }
  assert.equal(canBrowseArchivedClaims("DIRECTOR_AUDIT"), false);
  assert.equal(canBrowseArchivedClaims("EMPLOYER_SUBMITTER"), false);
});
