import assert from "node:assert/strict";
import test from "node:test";

import { getTrainingMonitoringTransitions, isMonitoringTransitionForMode } from "../lib/training-monitoring";
import { getTrainingRequestEvidenceKinds, getTrainingRequestTransitions } from "../lib/training-request";

test("Form 4A evidence accepts a training synopsis", () => {
  assert.equal(getTrainingRequestEvidenceKinds().includes("TRAINING_SYNOPSIS"), true);
});

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
    "hq_ro_submit",
    "hod_accept",
    "hod_reject",
    "hod_to_hq_ro",
    "dfsd_release",
    "dfsd_to_hod",
  ]);
  assert.equal((transitions as readonly string[]).includes("approve"), false);
});

test("virtual monitoring only accepts the HQ route and physical monitoring only accepts Area Office actions", () => {
  assert.equal(isMonitoringTransitionForMode("hq_ro_submit", "LOCAL_VIRTUAL"), true);
  assert.equal(isMonitoringTransitionForMode("hod_accept", "LOCAL_VIRTUAL"), true);
  assert.equal(isMonitoringTransitionForMode("dfsd_release", "LOCAL_VIRTUAL"), true);
  assert.equal(isMonitoringTransitionForMode("am_release", "LOCAL_VIRTUAL"), false);
  assert.equal(isMonitoringTransitionForMode("ro_submit", "LOCAL_PHYSICAL"), true);
  assert.equal(isMonitoringTransitionForMode("hq_ro_submit", "LOCAL_PHYSICAL"), false);
});
