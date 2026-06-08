import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEvidenceDocumentName } from "../lib/evidence-metadata";

test("other supporting evidence requires and trims a document name", () => {
  assert.equal(
    normalizeEvidenceDocumentName("OTHER_SUPPORTING_EVIDENCE", "  Board resolution  "),
    "Board resolution",
  );
  assert.throws(
    () => normalizeEvidenceDocumentName("OTHER_SUPPORTING_EVIDENCE", " "),
    /Document name is required/,
  );
});

test("predefined evidence types do not retain a custom document name", () => {
  assert.equal(normalizeEvidenceDocumentName("CAC_CERTIFICATE", "Ignored name"), null);
});
