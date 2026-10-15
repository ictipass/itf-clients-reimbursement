import assert from "node:assert/strict";
import test from "node:test";

import { createObjectKey } from "../lib/storage/object-key";

test("storage keys are unique and grouped by namespace and company", () => {
  const input = {
    buffer: Buffer.from("sample"),
    companyId: "company-123",
    extension: ".pdf",
    mimeType: "application/pdf",
    namespace: "claim-evidence",
  };
  const first = createObjectKey(input);
  const second = createObjectKey(input);
  assert.match(first, /^claim-evidence\/company-123\/\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/);
  assert.notEqual(first, second);
});
