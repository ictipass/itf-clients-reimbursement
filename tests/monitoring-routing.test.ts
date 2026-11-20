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
    role: "HEAD_OF_DIVISION",
    sourceSuffix: "hq-assignment",
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
    { role: "HQ_REIMBURSEMENT_OFFICER", workspaceId: "workspace-1", areaOfficeId: null, organizationId: null },
  ], "officer-1"), {
    mode: "LOCAL_VIRTUAL",
    trainingRequest: { company: { organization: { workspaceId: { in: ["workspace-1"] } } } },
    OR: [
      { currentDesk: "HQ_REIMBURSEMENT_OFFICER", workItems: { some: { app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN", assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: "officer-1" } } },
      { currentDesk: { not: "HQ_REIMBURSEMENT_OFFICER" }, workItems: { some: { app: "REIMBURSEMENT", recordTier: "HOT", assignedRole: "HQ_REIMBURSEMENT_OFFICER", assignedUserId: "officer-1" } } },
    ],
  });
  assert.deepEqual(monitoringVisibilityWhere("HQ_REIMBURSEMENT_OFFICER", [
    { role: "HQ_REIMBURSEMENT_OFFICER", workspaceId: "workspace-1", areaOfficeId: "ao-1", organizationId: null },
  ], "officer-1"), { id: "__no_monitoring_access__" });
  assert.deepEqual(monitoringVisibilityWhere("HQ_REIMBURSEMENT_OFFICER", [
    { role: "HQ_REIMBURSEMENT_OFFICER", workspaceId: "workspace-1", areaOfficeId: null, organizationId: null },
  ]), { id: "__no_monitoring_access__" });
  assert.deepEqual(monitoringVisibilityWhere("HEAD_OF_DIVISION", [
    { role: "HEAD_OF_DIVISION", workspaceId: "workspace-1", areaOfficeId: null, organizationId: null },
  ]), {
    mode: "LOCAL_VIRTUAL",
    trainingRequest: { company: { organization: { workspaceId: { in: ["workspace-1"] } } } },
  });
  assert.deepEqual(monitoringVisibilityWhere("REIMBURSEMENT_OFFICER", [
    { role: "REIMBURSEMENT_OFFICER", workspaceId: "workspace-1", areaOfficeId: "ao-1", organizationId: null },
  ]), {
    mode: "LOCAL_PHYSICAL",
    trainingRequest: { company: { areaOfficeId: { in: ["ao-1"] } } },
  });
  assert.deepEqual(monitoringVisibilityWhere("REIMBURSEMENT_OFFICER", [
    { role: "REIMBURSEMENT_OFFICER", workspaceId: "workspace-1", areaOfficeId: "ao-2", organizationId: null },
  ]), {
    mode: "LOCAL_PHYSICAL",
    trainingRequest: { company: { areaOfficeId: { in: ["ao-2"] } } },
  });
});
