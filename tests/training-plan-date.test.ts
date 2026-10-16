import assert from "node:assert/strict";
import test from "node:test";

import { getTrainingPlanCsvTemplate, parseTrainingPlanDate } from "../lib/training-plan";

test("training plan template dates are accepted, including Excel's day-first format", () => {
  const sampleDate = getTrainingPlanCsvTemplate().split("\n")[1].split(",")[5];
  assert.equal(parseTrainingPlanDate(sampleDate)?.toISOString(), "2026-08-15T00:00:00.000Z");
  assert.equal(parseTrainingPlanDate("15/08/2026")?.toISOString(), "2026-08-15T00:00:00.000Z");
  assert.throws(() => parseTrainingPlanDate("31/02/2026"), /valid calendar date/);
  assert.throws(() => parseTrainingPlanDate("08/15/2026"), /valid calendar date/);
});
