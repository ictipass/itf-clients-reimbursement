import assert from "node:assert/strict";
import test from "node:test";

import { getTrainingRequestMissingRequirements } from "../lib/training-request";

test("Form 4A does not require an impromptu-gap justification", () => {
  assert.deepEqual(getTrainingRequestMissingRequirements({
    title: "Leadership training",
    provider: "ITF",
    startsAt: new Date("2026-10-18T09:00:00Z"),
    endsAt: new Date("2026-10-18T17:00:00Z"),
    estimatedCost: { toString: () => "250000" },
    isAdHoc: true,
    adHocJustification: null,
    deliveryMode: "LOCAL_PHYSICAL",
    onlineUrl: null,
    _count: { participants: 1, documents: 1 },
  }), []);
});
