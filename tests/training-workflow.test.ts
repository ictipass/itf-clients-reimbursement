import assert from "node:assert/strict";
import test from "node:test";

import { getTrainingMonitoringTransitions } from "../lib/training-monitoring";
import { getTrainingRequestTransitions } from "../lib/training-request";

test("Form 4A decisions and feedback follow the required Area Office route", () => {
  const transitions = getTrainingRequestTransitions();

  assert.deepEqual(transitions, [
    "am_to_hot",
    "hot_to_ro",
    "ro_approve",
    "ro_reject",
    "hot_to_am",
    "am_release",
  ]);
  assert.equal((transitions as readonly string[]).includes("am_approve"), false);
  assert.equal((transitions as readonly string[]).includes("ro_to_company"), false);
});

test("monitoring decisions are made by HOT and released by the Area Manager", () => {
  const transitions = getTrainingMonitoringTransitions();

  assert.deepEqual(transitions, [
    "ro_submit",
    "hot_accept",
    "hot_reject",
    "hot_to_ro",
    "am_release",
    "am_to_hot",
  ]);
  assert.equal((transitions as readonly string[]).includes("approve"), false);
});
