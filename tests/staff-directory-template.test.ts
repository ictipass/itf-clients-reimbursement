import assert from "node:assert/strict";
import test from "node:test";

import { getUserCsvTemplate } from "../lib/user-directory";

test("user import template includes office and workflow role before staff classification", () => {
  assert.equal(
    getUserCsvTemplate().trim(),
    "full name,staff number,email address,phone number,office,role,department,job title",
  );
});
