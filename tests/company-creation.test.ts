import assert from "node:assert/strict";
import test from "node:test";

import { resolveCompanyCreationMembership } from "../lib/registry";

const memberships = [
  { id: "unlinked", organizationId: null, workspaceId: "workspace", workspace: { revenueWorkflowMode: "EXTERNAL_VERIFICATION" as const } },
  { id: "other-org", organizationId: "organization-2", workspaceId: "workspace", workspace: { revenueWorkflowMode: "IN_APP_REVENUE" as const } },
  { id: "selected-org", organizationId: "organization-1", workspaceId: "workspace", workspace: { revenueWorkflowMode: "EXTERNAL_VERIFICATION" as const } },
];

test("first-company creation uses the unlinked employer administrator membership", () => {
  assert.equal(resolveCompanyCreationMembership({ active: null, requiresSelection: false }, memberships).id, "unlinked");
});

test("additional companies use the administrator membership of the selected organization", () => {
  assert.equal(resolveCompanyCreationMembership({ active: { id: "organization-1" }, requiresSelection: false }, memberships).id, "selected-org");
  assert.equal(resolveCompanyCreationMembership({ active: { id: "organization-2" }, requiresSelection: false }, memberships).id, "other-org");
});

test("company creation refuses ambiguous or non-administrator organization context", () => {
  assert.throws(() => resolveCompanyCreationMembership({ active: null, requiresSelection: true }, memberships), /Select an active organization/);
  assert.throws(() => resolveCompanyCreationMembership({ active: { id: "viewer-only" }, requiresSelection: false }, memberships), /not ready to create a company/);
});
