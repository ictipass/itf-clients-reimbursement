import assert from "node:assert/strict";
import test from "node:test";

import { requiresApplicationPasswordChange } from "../lib/authentication-policy";

test("only local identities use the application password-change gate", () => {
  assert.equal(requiresApplicationPasswordChange("LOCAL", true), true);
  assert.equal(requiresApplicationPasswordChange("GOOGLE", true), false);
  assert.equal(requiresApplicationPasswordChange("WORKSPACE_SSO", true), false);
});
