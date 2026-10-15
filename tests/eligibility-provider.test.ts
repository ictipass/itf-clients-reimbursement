import assert from "node:assert/strict";
import test from "node:test";

import { isTestEligibilityConfigurationAllowed, usesPreviewEligibilityRecords } from "../lib/eligibility-provider";

test("test records are available only in local development or explicitly selected Vercel Preview", () => {
  assert.equal(isTestEligibilityConfigurationAllowed({ NODE_ENV: "development" }), true);
  assert.equal(usesPreviewEligibilityRecords({ VERCEL_ENV: "preview", ELIGIBILITY_PROVIDER: "TEST_RECORDS" }), true);
  assert.equal(isTestEligibilityConfigurationAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview", ELIGIBILITY_PROVIDER: "TEST_RECORDS" }), true);
  assert.equal(isTestEligibilityConfigurationAllowed({ NODE_ENV: "production", VERCEL_ENV: "production", ELIGIBILITY_PROVIDER: "TEST_RECORDS" }), false);
  assert.equal(isTestEligibilityConfigurationAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview", ELIGIBILITY_PROVIDER: "REAL_API" }), false);
});
