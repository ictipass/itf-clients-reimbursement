import assert from "node:assert/strict";
import test from "node:test";

import { generateTemporaryPassword } from "../lib/officer-provisioning";

test("temporary officer passwords contain strong character groups", () => {
  const password = generateTemporaryPassword();
  assert.equal(password.length, 16);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!@#$%]/);
});
