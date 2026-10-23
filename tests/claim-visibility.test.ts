import assert from "node:assert/strict";
import test from "node:test";

import { buildClaimVisibilityWhere } from "../lib/claim-visibility";

const workspaceId = "workspace-1";

test("HQ RO only sees packets routed to the HQ RO desk in their workspace", () => {
  assert.deepEqual(buildClaimVisibilityWhere("HQ_REIMBURSEMENT_OFFICER", [{
    role: "HQ_REIMBURSEMENT_OFFICER", workspaceId, organizationId: "itf-hq", areaOfficeId: null,
  }]), {
    company: { organization: { workspaceId: { in: [workspaceId] } } },
    workItems: { some: { assignedRole: "HQ_REIMBURSEMENT_OFFICER", app: "REIMBURSEMENT", recordTier: "HOT" } },
  });
});

test("Head of Division has a separate packet assignment from HQ RO", () => {
  const where = buildClaimVisibilityWhere("HEAD_OF_DIVISION", [{
    role: "HEAD_OF_DIVISION", workspaceId, organizationId: "itf-hq", areaOfficeId: null,
  }]);
  assert.deepEqual(where.workItems, { some: { assignedRole: "HEAD_OF_DIVISION", app: "REIMBURSEMENT", recordTier: "HOT" } });
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
