import assert from "node:assert/strict";
import test from "node:test";

import { summarizeTrainingRequestAreas } from "../lib/training-request-area";

test("shows the shared participant training area", () => {
  assert.equal(summarizeTrainingRequestAreas([{ trainingArea: "Management" }, { trainingArea: "Management" }]), "Management");
});

test("shows Mixed when participants have distinct training areas", () => {
  assert.equal(summarizeTrainingRequestAreas([{ trainingArea: "Management" }, { trainingArea: "Supervisory" }]), "Mixed");
});

test("ignores missing areas and handles requests without a training area", () => {
  assert.equal(summarizeTrainingRequestAreas([{ trainingArea: "Management" }, { trainingArea: null }]), "Management");
  assert.equal(summarizeTrainingRequestAreas([{ trainingArea: null }]), "Not provided");
});
