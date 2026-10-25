import assert from "node:assert/strict";
import test from "node:test";

import {
  addClaimLine,
  calculateAreaOfficeClaim,
  calculateHeadquartersClaim,
  canRouteClaimFromDesk,
  getLatestClaimRoutingReason,
  getClaimIntakeTransitions,
  getClaimCorrectionReturnTarget,
  getClaimPostIntakeTransitions,
  isClaimPostIntakeTransitionAvailable,
} from "../lib/claims";

test("only the Area Office RO may calculate reviewed Form 1B", async () => {
  await assert.rejects(calculateAreaOfficeClaim({
    claimId: "claim-1", requesterEmail: "hot@example.test", requesterRole: "HEAD_OF_TRAINING",
    verified: { siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: false },
    reviewerRemarks: "Reviewed", reviewedForm1A: true, reviewedForm2A: true, reviewedEvidence: true,
  }), /Only the Area Office Reimbursement Officer/);
});

test("only the HQ RO may calculate the independent HQ Form 1B", async () => {
  await assert.rejects(calculateHeadquartersClaim({
    claimId: "claim-1", requesterEmail: "area.ro@example.test", requesterRole: "REIMBURSEMENT_OFFICER",
    verified: { siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: false },
    reviewerRemarks: "Reviewed", reviewedForm1A: true, reviewedForm2A: true, reviewedEvidence: true,
  }), /Only the HQ Reimbursement Officer/);
  await assert.rejects(calculateHeadquartersClaim({
    claimId: "claim-1", requesterEmail: "hq.ro@example.test", requesterRole: "HQ_REIMBURSEMENT_OFFICER",
    verified: { siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: false },
    reviewerRemarks: "", reviewedForm1A: true, reviewedForm2A: true, reviewedEvidence: true,
  }), /HQ RO must record a review remark/);
});

test("staff cannot create employer claim calculation rows through the service", async () => {
  await assert.rejects(addClaimLine({
    claimId: "claim-1",
    requesterEmail: "area.manager@example.test",
    requesterRole: "AREA_MANAGER",
    trainingArea: "Management",
  }), /Only employers can edit claim calculations/);
});

test("routes reimbursement claim intake through AM, HOT, then A/O reimbursement officer", () => {
  const transitions = getClaimIntakeTransitions();

  assert.deepEqual(
    transitions.map((transition) => [
      transition.from,
      transition.to,
      transition.assignedRole,
    ]),
    [
      ["COMPANY", "AREA_MANAGER", "AREA_MANAGER"],
      ["AREA_MANAGER", "HEAD_OF_TRAINING", "HEAD_OF_TRAINING"],
      ["HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER", "REIMBURSEMENT_OFFICER"],
    ],
  );
});

test("routes processed reimbursement claims through HQ, audit, and finance desks", () => {
  const transitions = getClaimPostIntakeTransitions();

  assert.equal(
    transitions.find((transition) => transition.from === "HEAD_OF_TRAINING" && transition.to === "AREA_MANAGER")?.action,
    "RECOMMEND",
  );

  assert.equal(
    transitions.find((transition) => transition.from === "AREA_MANAGER" && transition.to === "DIRECTOR_FSD")?.action,
    "APPROVE",
  );
  assert.equal(
    transitions.find((transition) => transition.from === "DIRECTOR_FSD" && transition.to === "DIRECTOR_AUDIT")?.action,
    "APPROVE",
  );

  assert.deepEqual(
    transitions.map((transition) => [
      transition.from,
      transition.to,
      transition.assignedRole,
    ]),
    [
      ["REIMBURSEMENT_OFFICER", "HEAD_OF_TRAINING", "HEAD_OF_TRAINING"],
      ["HEAD_OF_TRAINING", "AREA_MANAGER", "AREA_MANAGER"],
      ["AREA_MANAGER", "DIRECTOR_FSD", "DIRECTOR_FSD"],
      ["DIRECTOR_FSD", "HEAD_OF_DIVISION", "HEAD_OF_DIVISION"],
      ["HEAD_OF_DIVISION", "HQ_REIMBURSEMENT_OFFICER", "HQ_REIMBURSEMENT_OFFICER"],
      ["HQ_REIMBURSEMENT_OFFICER", "HEAD_OF_DIVISION", "HEAD_OF_DIVISION"],
      ["HEAD_OF_DIVISION", "DIRECTOR_FSD", "DIRECTOR_FSD"],
      ["DIRECTOR_FSD", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
      ["DIRECTOR_AUDIT", "HEAD_REIMBURSEMENT_AUDIT", "HEAD_REIMBURSEMENT_AUDIT"],
      [
        "HEAD_REIMBURSEMENT_AUDIT",
        "REIMBURSEMENT_SCHEDULE_AUDITOR",
        "REIMBURSEMENT_SCHEDULE_AUDITOR",
      ],
      [
        "REIMBURSEMENT_SCHEDULE_AUDITOR",
        "HEAD_REIMBURSEMENT_AUDIT",
        "HEAD_REIMBURSEMENT_AUDIT",
      ],
      ["HEAD_REIMBURSEMENT_AUDIT", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
      ["DIRECTOR_AUDIT", "DIRECTOR_GENERAL", "DIRECTOR_GENERAL"],
      ["DIRECTOR_GENERAL", "DIRECTOR_FINANCE", "DIRECTOR_FINANCE"],
      ["DIRECTOR_FINANCE", "HEAD_ACCOUNTS", "HEAD_ACCOUNTS"],
      ["HEAD_ACCOUNTS", "HEAD_REIMBURSEMENT_FINANCE", "HEAD_REIMBURSEMENT_FINANCE"],
      [
        "HEAD_REIMBURSEMENT_FINANCE",
        "REIMBURSEMENT_ACCOUNTANT",
        "REIMBURSEMENT_ACCOUNTANT",
      ],
      ["REIMBURSEMENT_ACCOUNTANT", "HEAD_REIMBURSEMENT_FINANCE", "HEAD_REIMBURSEMENT_FINANCE"],
      ["HEAD_REIMBURSEMENT_FINANCE", "HEAD_BUDGET", "HEAD_BUDGET"],
      ["HEAD_BUDGET", "BUDGET_OFFICER", "BUDGET_OFFICER"],
      ["BUDGET_OFFICER", "HEAD_BUDGET", "HEAD_BUDGET"],
      ["HEAD_BUDGET", "DIRECTOR_AUDIT", "DIRECTOR_AUDIT"],
      ["DIRECTOR_AUDIT", "HEAD_PRE_AUDIT", "HEAD_PRE_AUDIT"],
      ["HEAD_PRE_AUDIT", "PRE_AUDIT_OFFICER", "PRE_AUDIT_OFFICER"],
      ["PRE_AUDIT_OFFICER", "HEAD_PRE_AUDIT", "HEAD_PRE_AUDIT"],
      ["HEAD_PRE_AUDIT", "HEAD_REIMBURSEMENT_FINANCE", "HEAD_REIMBURSEMENT_FINANCE"],
      ["REIMBURSEMENT_ACCOUNTANT", "HEAD_ACCOUNTS", "HEAD_ACCOUNTS"],
      ["HEAD_ACCOUNTS", "HEAD_EXPENDITURE", "HEAD_EXPENDITURE"],
      ["HEAD_EXPENDITURE", "EXPENDITURE_ACCOUNTANT", "EXPENDITURE_ACCOUNTANT"],
      ["EXPENDITURE_ACCOUNTANT", "PAYMENT_INITIATOR", "PAYMENT_INITIATOR"],
      ["PAYMENT_INITIATOR", "HEAD_EXPENDITURE", "HEAD_EXPENDITURE"],
      ["HEAD_EXPENDITURE", "HEAD_REIMBURSEMENT_FINANCE", "HEAD_REIMBURSEMENT_FINANCE"],
    ],
  );
});

test("repeated finance desks expose only the next valid handoff", () => {
  const available = (from: Parameters<typeof isClaimPostIntakeTransitionAvailable>[0]["from"], to: Parameters<typeof isClaimPostIntakeTransitionAvailable>[0]["to"], reason: string, options: Partial<Parameters<typeof isClaimPostIntakeTransitionAvailable>[0]> = {}) =>
    isClaimPostIntakeTransitionAvailable({ from, to, lastRoutingReason: reason, paymentVoucherRaised: false, preAuditReturned: false, paymentReturned: false, scheduleCreated: false, ...options });

  assert.equal(available("REIMBURSEMENT_ACCOUNTANT", "HEAD_REIMBURSEMENT_FINANCE", "", { paymentVoucherRaised: false }), false);
  assert.equal(available("REIMBURSEMENT_ACCOUNTANT", "HEAD_REIMBURSEMENT_FINANCE", "", { paymentVoucherRaised: true }), true);
  assert.equal(available("REIMBURSEMENT_ACCOUNTANT", "HEAD_ACCOUNTS", "", { preAuditReturned: true, scheduleCreated: false }), false);
  assert.equal(available("REIMBURSEMENT_ACCOUNTANT", "HEAD_ACCOUNTS", "", { preAuditReturned: true, scheduleCreated: true }), true);
  assert.equal(available("REIMBURSEMENT_ACCOUNTANT", "HEAD_ACCOUNTS", "", { preAuditReturned: true, scheduleCreated: true, paymentReturned: true }), false);
  assert.equal(available("HEAD_ACCOUNTS", "HEAD_EXPENDITURE", "DFAD forwarded reimbursement claim to Head of Accounts."), false);
  assert.equal(available("HEAD_ACCOUNTS", "HEAD_EXPENDITURE", "Reimbursement Schedule Accountant forwarded e-payment schedule to Head of Accounts."), true);
  assert.equal(getLatestClaimRoutingReason([{ reason: "Updated reimbursement payment handoff status to PV RAISED." }, { reason: "Head of Accounts forwarded claim to Head of Reimbursement Account." }]), "Head of Accounts forwarded claim to Head of Reimbursement Account.");
});

test("only the current desk role can route a reimbursement claim", () => {
  assert.equal(canRouteClaimFromDesk("DIRECTOR_AUDIT", "DIRECTOR_AUDIT"), true);
  assert.equal(canRouteClaimFromDesk("DIRECTOR_FINANCE", "DIRECTOR_AUDIT"), false);
  assert.equal(canRouteClaimFromDesk("HEAD_BUDGET", "HEAD_BUDGET"), true);
  assert.equal(canRouteClaimFromDesk("BUDGET_OFFICER", "HEAD_BUDGET"), false);
  assert.equal(canRouteClaimFromDesk("PRE_AUDIT_OFFICER", "PRE_AUDIT_OFFICER"), true);
  assert.equal(canRouteClaimFromDesk("SYSTEM_ADMIN", "DIRECTOR_AUDIT"), true);
  assert.equal(canRouteClaimFromDesk("EMPLOYER_SUBMITTER", "COMPANY"), true);
});

test("HQ correction returns are available only after the subordinate sent the packet", () => {
  assert.equal(getClaimCorrectionReturnTarget("HEAD_OF_DIVISION", "HQ RO returned reimbursement claim to Head Reimbursement Division."), "HQ_REIMBURSEMENT_OFFICER");
  assert.equal(getClaimCorrectionReturnTarget("HEAD_OF_DIVISION", "Director FSD forwarded reimbursement claim to Head Reimbursement Division."), null);
  assert.equal(getClaimCorrectionReturnTarget("HEAD_REIMBURSEMENT_AUDIT", "Reimbursement Schedule Auditor returned audit result to Head Reimbursement Audit."), "REIMBURSEMENT_SCHEDULE_AUDITOR");
  assert.equal(getClaimCorrectionReturnTarget("HEAD_BUDGET", "Budget Officer returned reimbursement budget clearance to Head Budget."), "BUDGET_OFFICER");
  assert.equal(getClaimCorrectionReturnTarget("HEAD_PRE_AUDIT", "Pre-Audit Officer returned reimbursement payment audit result to Head Pre-Audit."), "PRE_AUDIT_OFFICER");
});
