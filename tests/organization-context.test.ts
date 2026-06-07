import assert from "node:assert/strict";
import test from "node:test";

import { resolveActiveEmployerOrganization } from "../lib/organization-context";
import type { Role } from "../lib/rbac";

const organizations: Array<{ id: string; name: string; role: Role }> = [
  { id: "org-a", name: "Organization A", role: "EMPLOYER_ADMIN" },
  { id: "org-b", name: "Organization B", role: "EMPLOYER_VIEWER" },
];

test("a valid selected organization determines the active role", () => {
  const result = resolveActiveEmployerOrganization(organizations, "org-b");
  assert.equal(result.active?.id, "org-b");
  assert.equal(result.active?.role, "EMPLOYER_VIEWER");
  assert.equal(result.requiresSelection, false);
});

test("an unknown organization selection is rejected", () => {
  const result = resolveActiveEmployerOrganization(organizations, "org-outside-memberships");
  assert.equal(result.active, null);
  assert.equal(result.requiresSelection, true);
});
