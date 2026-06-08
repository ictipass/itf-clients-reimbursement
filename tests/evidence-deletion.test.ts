import assert from "node:assert/strict";
import test from "node:test";

import { isEvidenceWorkflowEditable } from "../lib/evidence-deletion";

test("unsubmitted evidence remains editable", () => {
  assert.equal(isEvidenceWorkflowEditable([]), true);
  assert.equal(isEvidenceWorkflowEditable(["DRAFT"]), true);
  assert.equal(isEvidenceWorkflowEditable(["CHANGES_REQUESTED"]), true);
});

test("submitted evidence is permanently locked", () => {
  assert.equal(isEvidenceWorkflowEditable(["SUBMITTED"]), false);
  assert.equal(isEvidenceWorkflowEditable(["DRAFT", "APPROVED"]), false);
});
