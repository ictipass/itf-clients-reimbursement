import assert from "node:assert/strict";
import test from "node:test";

import { assertEmailDeliveryReady, escapeEmailHtml } from "../lib/email";

test("email HTML escapes active markup", () => {
  assert.equal(
    escapeEmailHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});

test("email delivery validates the sender before provisioning users", () => {
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  try {
    process.env.EMAIL_DELIVERY_MODE = "resend";
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "reimbursement-support@itf.gov.ng>";
    assert.throws(assertEmailDeliveryReady, /EMAIL_FROM/);
    process.env.EMAIL_FROM = "reimbursement-support@itf.gov.ng";
    assert.doesNotThrow(assertEmailDeliveryReady);
    process.env.EMAIL_FROM = "ITF Support <reimbursement-support@itf.gov.ng>";
    assert.doesNotThrow(assertEmailDeliveryReady);
  } finally {
    for (const [key, value] of [["EMAIL_DELIVERY_MODE", previous.mode], ["RESEND_API_KEY", previous.key], ["EMAIL_FROM", previous.from]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
