import assert from "node:assert/strict";
import test from "node:test";

import { escapeEmailHtml } from "../lib/email";

test("email HTML escapes active markup", () => {
  assert.equal(
    escapeEmailHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});
