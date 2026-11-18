import assert from "node:assert/strict";
import test from "node:test";

import { isCompanyDetailCorrectionOpen, isSubmittedArtifactEditable } from "../lib/employer-correction";

test("only a correction at the company desk opens company detail editing", () => {
  assert.equal(isCompanyDetailCorrectionOpen({ registration: { status: "CHANGES_REQUESTED", currentDesk: "COMPANY" } }), true);
  assert.equal(isCompanyDetailCorrectionOpen({ registration: { status: "CHANGES_REQUESTED", currentDesk: "AREA_MANAGER" } }), false);
  assert.equal(isCompanyDetailCorrectionOpen({ trainingPlans: [{ status: "CHANGES_REQUESTED", currentDesk: "COMPANY" }] }), true);
  assert.equal(isCompanyDetailCorrectionOpen({ complianceYears: [{ status: "CHANGES_REQUESTED" }] }), true);
  assert.equal(isCompanyDetailCorrectionOpen({ trainingPlans: [{ status: "SUBMITTED", currentDesk: "COMPANY" }] }), false);
});

test("submitted files and request details remain locked during correction", () => {
  assert.equal(isSubmittedArtifactEditable("DRAFT", "COMPANY"), true);
  assert.equal(isSubmittedArtifactEditable("DRAFT", "AREA_MANAGER"), false);
  assert.equal(isSubmittedArtifactEditable("CHANGES_REQUESTED", "COMPANY"), false);
  assert.equal(isSubmittedArtifactEditable("SUBMITTED", "COMPANY"), false);
});
