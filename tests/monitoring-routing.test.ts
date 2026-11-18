import assert from "node:assert/strict";
import test from "node:test";

import {
  canMonitorAtDesk,
  getMonitoringInitialAssignment,
  monitoringVisibilityWhere,
} from "../lib/monitoring-routing";

test("virtual training starts at HQ, while physical training stays at Area Office", () => {
  assert.deepEqual(getMonitoringInitialAssignment("LOCAL_ONLINE"), {
    mode: "LOCAL_VIRTUAL",
    desk: "HQ_REIMBURSEMENT_OFFICER",
    role: "HQ_REIMBURSEMENT_OFFICER",
    sourceSuffix: "hq-reimbursement-officer",
  });
  assert.equal(getMonitoringInitialAssignment("LOCAL_PHYSICAL").desk, "REIMBURSEMENT_OFFICER");
});

test("HQ and Area Office desks cannot act on each other's monitoring modes", () => {
  assert.equal(canMonitorAtDesk("HQ_REIMBURSEMENT_OFFICER", "LOCAL_VIRTUAL", "HQ_REIMBURSEMENT_OFFICER"), true);
  assert.equal(canMonitorAtDesk("HEAD_OF_DIVISION", "LOCAL_VIRTUAL", "HEAD_OF_DIVISION"), true);
  assert.equal(canMonitorAtDesk("DIRECTOR_FSD", "LOCAL_VIRTUAL", "DIRECTOR_FSD"), true);
  assert.equal(canMonitorAtDesk("REIMBURSEMENT_OFFICER", "LOCAL_VIRTUAL", "HQ_REIMBURSEMENT_OFFICER"), false);
  assert.equal(canMonitorAtDesk("HQ_REIMBURSEMENT_OFFICER", "LOCAL_PHYSICAL", "REIMBURSEMENT_OFFICER"), false);
  assert.equal(canMonitorAtDesk("REIMBURSEMENT_OFFICER", "LOCAL_PHYSICAL", "REIMBURSEMENT_OFFICER"), true);
});

test("monitoring calendar visibility respects HQ and Area Office assignments", () => {
  assert.deepEqual(monitoringVisibilityWhere("HQ_REIMBURSEMENT_OFFICER", [
    { role: "HQ_REIMBURSEMENT_OFFICER", areaOfficeId: null, organizationId: null },
  ]), { mode: "LOCAL_VIRTUAL" });
  assert.deepEqual(monitoringVisibilityWhere("HQ_REIMBURSEMENT_OFFICER", [
    { role: "HQ_REIMBURSEMENT_OFFICER", areaOfficeId: "ao-1", organizationId: null },
  ]), { id: "__no_monitoring_access__" });
  assert.deepEqual(monitoringVisibilityWhere("REIMBURSEMENT_OFFICER", [
    { role: "REIMBURSEMENT_OFFICER", areaOfficeId: "ao-1", organizationId: null },
  ]), {
    mode: "LOCAL_PHYSICAL",
    trainingRequest: { company: { areaOfficeId: { in: ["ao-1"] } } },
  });
  assert.deepEqual(monitoringVisibilityWhere("REIMBURSEMENT_OFFICER", [
    { role: "REIMBURSEMENT_OFFICER", areaOfficeId: "ao-2", organizationId: null },
  ]), {
    mode: "LOCAL_PHYSICAL",
    trainingRequest: { company: { areaOfficeId: { in: ["ao-2"] } } },
  });
});
