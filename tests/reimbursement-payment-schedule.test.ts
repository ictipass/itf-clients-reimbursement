import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import {
  canDownloadEpaymentSchedule,
  buildReimbursementPaymentScheduleWorkbook,
  buildReimbursementPaymentScheduleFilename,
  buildReimbursementPaymentScheduleReference,
  formatReimbursementPaymentHandoffStatus,
  isReimbursementPaymentHandoffStatus,
  validateReimbursementPaymentSchedule,
} from "../lib/reimbursement-payment-schedule";

test("builds reimbursement e-payment XLSX with the required columns and net payable amount", async () => {
  const bytes = await buildReimbursementPaymentScheduleWorkbook({
    reference: "CLM-001",
    claimYear: 2026,
    itfReceiptNumber: "ITF-RCPT-7",
    bankName: "Example Bank",
    accountNumber: "0123456789",
    sortCode: "123456",
    paymentAccountType: "Current",
    paymentWithholdingTax: { toString: () => "25000" },
    paymentTaxOffset: { toString: () => "5000" },
    claimRecommendedAmount: { toString: () => "1500000" },
    claimRecommendedInWords: "One million five hundred thousand naira only",
    paymentScheduleReference: null,
    paymentHandoffStatus: "READY_FOR_EXPORT",
    company: {
      legalName: "Ada Training Ltd",
      email: "accounts@example.com",
      telephone: "08012345678",
      itfEmployerNumber: "ITF/ABJ/001",
      areaOffice: {
        name: "Abuja Area Office",
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  assert.deepEqual(Array.from({ length: 12 }, (_, index) => sheet.getRow(1).getCell(index + 1).value), ["Bank Code", "Account Number", "Account Type", "Payable Amount", "Short Description", "Long Description", "Name", "Bank", "Mobile Number", "Email", "WHT", "Tax Off"]);
  assert.equal(sheet.getRow(2).getCell(1).value, "123456");
  assert.equal(sheet.getRow(2).getCell(2).value, "0123456789");
  assert.equal(sheet.getRow(2).getCell(4).value, 1470000);
  assert.equal(sheet.getRow(2).getCell(11).value, 25000);
  assert.equal(sheet.getRow(2).getCell(12).value, 5000);
});

test("schedule rejects unconfirmed deductions and deductions above the award", () => {
  const claim = {
    reference: "CLM-001", claimYear: 2026, itfReceiptNumber: null,
    bankName: "Example Bank", accountNumber: "0123456789", sortCode: "123456",
    paymentAccountType: "Current", paymentWithholdingTax: null, paymentTaxOffset: null,
    claimRecommendedAmount: { toString: () => "100" }, claimRecommendedInWords: null,
    paymentScheduleReference: null, paymentHandoffStatus: "EXPORTED" as const,
    company: { legalName: "Ada Training Ltd", email: "accounts@example.com", telephone: "08012345678", itfEmployerNumber: null, areaOffice: null },
  };
  assert.throws(() => validateReimbursementPaymentSchedule(claim), /confirm WHT/);
  assert.throws(() => validateReimbursementPaymentSchedule({ ...claim, paymentWithholdingTax: { toString: () => "80" }, paymentTaxOffset: { toString: () => "30" } }), /do not exceed/);
});

test("uses stable reimbursement payment schedule naming", () => {
  assert.equal(
    buildReimbursementPaymentScheduleReference({ reference: "CLM-001", claimYear: 2026 }),
    "ITF-RMB-2026-CLM-001",
  );
  assert.equal(
    buildReimbursementPaymentScheduleFilename({ reference: "CLM-001", claimYear: 2026 }),
    "reimbursement-payment-schedule-2026-CLM-001.xlsx",
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
