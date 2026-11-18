import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEmployerSubmissionAcknowledged,
  EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT,
} from "../lib/submission-acknowledgement";

test("final employer submission requires an explicit confirmation", () => {
  const form = new FormData();
  assert.throws(() => assertEmployerSubmissionAcknowledged(form), /confirm the submission disclaimer/);
  form.set(EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT, "no");
  assert.throws(() => assertEmployerSubmissionAcknowledged(form), /confirm the submission disclaimer/);
  form.set(EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT, "yes");
  assert.doesNotThrow(() => assertEmployerSubmissionAcknowledged(form));
});
