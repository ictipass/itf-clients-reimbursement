import assert from "node:assert/strict";
import test from "node:test";

import { getClaimFilingClock } from "../lib/claim-test-clock";

const realNow = new Date("2026-10-22T12:00:00Z");

test("local development can use a claim-only filing date", () => {
  const clock = getClaimFilingClock(
    { NODE_ENV: "development", CLAIM_TEST_AS_OF: "2027-01-15" },
    realNow,
  );
  assert.equal(clock.testDate, "2027-01-15");
  assert.equal(clock.now.toISOString(), "2027-01-15T12:00:00.000Z");
  assert.equal(realNow.toISOString(), "2026-10-22T12:00:00.000Z");
});

test("Vercel Preview can use a claim-only filing date", () => {
  const clock = getClaimFilingClock(
    { NODE_ENV: "production", VERCEL_ENV: "preview", CLAIM_TEST_AS_OF: "2027-06-30" },
    realNow,
  );
  assert.equal(clock.testDate, "2027-06-30");
});

test("production ignores the test clock even if configured", () => {
  const clock = getClaimFilingClock(
    { NODE_ENV: "production", VERCEL_ENV: "production", CLAIM_TEST_AS_OF: "2027-01-15" },
    realNow,
  );
  assert.equal(clock.testDate, null);
  assert.equal(clock.now, realNow);
});

test("a production Vercel deployment cannot use the test clock through NODE_ENV", () => {
  const clock = getClaimFilingClock(
    { NODE_ENV: "development", VERCEL_ENV: "production", CLAIM_TEST_AS_OF: "2027-01-15" },
    realNow,
  );
  assert.equal(clock.testDate, null);
  assert.equal(clock.now, realNow);
});

test("invalid test dates fail safely instead of rolling into another month", () => {
  assert.throws(
    () => getClaimFilingClock({ NODE_ENV: "development", CLAIM_TEST_AS_OF: "2027-02-30" }, realNow),
    /valid YYYY-MM-DD/,
  );
  assert.throws(
    () => getClaimFilingClock({ NODE_ENV: "development", CLAIM_TEST_AS_OF: "2027/01/15" }, realNow),
    /valid YYYY-MM-DD/,
  );
});
