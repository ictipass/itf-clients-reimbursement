import assert from "node:assert/strict";
import test from "node:test";

import {
  canDownloadEpaymentSchedule,
  buildReimbursementPaymentScheduleCsv,
  buildReimbursementPaymentScheduleFilename,
  buildReimbursementPaymentScheduleReference,
  formatReimbursementPaymentHandoffStatus,
  isReimbursementPaymentHandoffStatus,
} from "../lib/reimbursement-payment-schedule";

test("builds reimbursement e-payment schedule CSV for ERP handoff", () => {
  const csv = buildReimbursementPaymentScheduleCsv({
    reference: "CLM-001",
    claimYear: 2026,
    itfReceiptNumber: "ITF-RCPT-7",
    bankName: "Example Bank",
    accountNumber: "0123456789",
    sortCode: "123456",
    claimRecommendedAmount: { toString: () => "1500000" },
    claimRecommendedInWords: "One million five hundred thousand naira only",
    paymentScheduleReference: null,
    paymentHandoffStatus: "READY_FOR_EXPORT",
    company: {
      legalName: "Ada Training Ltd",
      itfEmployerNumber: "ITF/ABJ/001",
      areaOffice: {
        name: "Abuja Area Office",
      },
    },
  });

  assert.match(csv, /"Schedule Reference","Claim Reference","Employer Name"/);
  assert.match(csv, /"ITF-RMB-2026-CLM-001","CLM-001","Ada Training Ltd"/);
  assert.match(csv, /"1500000.00"/);
  assert.match(csv, /"Ready for export"/);
});

test("uses stable reimbursement payment schedule naming", () => {
  assert.equal(
    buildReimbursementPaymentScheduleReference({ reference: "CLM-001", claimYear: 2026 }),
    "ITF-RMB-2026-CLM-001",
  );
  assert.equal(
    buildReimbursementPaymentScheduleFilename({ reference: "CLM-001", claimYear: 2026 }),
    "reimbursement-payment-schedule-2026-CLM-001.csv",
  );
  assert.equal(formatReimbursementPaymentHandoffStatus("PV_RAISED"), "PV raised");
});

test("validates reimbursement payment handoff status values", () => {
  assert.equal(isReimbursementPaymentHandoffStatus("AUDIT_CLEARED"), true);
  assert.equal(isReimbursementPaymentHandoffStatus("KIV"), false);
});

test("schedule download is disabled before formal creation and restricted to its creator and later desks", () => {
  const exportedAt = new Date("2026-10-24T12:00:00Z");
  const base = {
    exportedAt, exportedById: "accountant-1", reference: "ITF-RMB-2026-CLM-001",
    requesterId: "accountant-1", requesterRole: "REIMBURSEMENT_ACCOUNTANT",
    deskAssignments: [{ assignedRole: "DIRECTOR_FSD", updatedAt: new Date("2026-10-23T12:00:00Z") }],
  };
  assert.equal(canDownloadEpaymentSchedule({ ...base, exportedAt: null }), false);
  assert.equal(canDownloadEpaymentSchedule({ ...base, reference: null }), false);
  assert.equal(canDownloadEpaymentSchedule(base), true);
  assert.equal(canDownloadEpaymentSchedule({ ...base, requesterId: "accountant-2", deskAssignments: [
    { assignedRole: "REIMBURSEMENT_ACCOUNTANT", updatedAt: new Date("2026-10-25T12:00:00Z") },
  ] }), false);
  assert.equal(canDownloadEpaymentSchedule({ ...base, requesterId: "director-1", requesterRole: "DIRECTOR_FSD" }), false);
  assert.equal(canDownloadEpaymentSchedule({ ...base, requesterId: "later-1", requesterRole: "HEAD_REIMBURSEMENT_FINANCE", deskAssignments: [
    { assignedRole: "HEAD_REIMBURSEMENT_FINANCE", updatedAt: new Date("2026-10-25T12:00:00Z") },
  ] }), true);
});
