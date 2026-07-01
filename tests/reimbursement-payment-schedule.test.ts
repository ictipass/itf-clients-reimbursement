import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReimbursementPaymentScheduleCsv,
  buildReimbursementPaymentScheduleFilename,
  buildReimbursementPaymentScheduleReference,
  formatReimbursementPaymentHandoffStatus,
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
