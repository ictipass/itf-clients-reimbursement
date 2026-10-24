import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

import { buildPaymentVoucherPdf, canDownloadPaymentVoucher, paymentVoucherFilename, paymentVoucherReference } from "../lib/reimbursement-payment-voucher";

test("creates a one-page payment voucher after the RSA raises it", async () => {
  const claim = {
    reference: "CLM-001", claimYear: 2026, bankName: "Example Bank", accountNumber: "0123456789",
    claimRecommendedAmount: { toString: () => "1500000" }, claimRecommendedInWords: "One million five hundred thousand naira only",
    company: { legalName: "Ada Training Ltd", businessAddress: "Abuja" },
  };
  const bytes = await buildPaymentVoucherPdf(claim, new Date("2026-10-24T12:00:00Z"), "Accountant One");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(paymentVoucherReference(claim), "PV-CLM-001");
  assert.equal(paymentVoucherFilename(claim), "payment-voucher-CLM-001.pdf");
  assert.ok(bytes.length > 2000);
});

test("voucher is unavailable before creation and only visible to creator and downstream desks", () => {
  const raisedAt = new Date("2026-10-24T12:00:00Z");
  const base = {
    raisedAt, raisedById: "rsa-1", requesterId: "rsa-1", requesterRole: "REIMBURSEMENT_ACCOUNTANT",
    deskAssignments: [{ assignedRole: "HEAD_BUDGET", updatedAt: new Date("2026-10-25T12:00:00Z") }],
  };
  assert.equal(canDownloadPaymentVoucher({ ...base, raisedAt: null }), false);
  assert.equal(canDownloadPaymentVoucher(base), true);
  assert.equal(canDownloadPaymentVoucher({ ...base, requesterId: "budget-1", requesterRole: "HEAD_BUDGET" }), true);
  assert.equal(canDownloadPaymentVoucher({ ...base, requesterId: "old-1", requesterRole: "DIRECTOR_FSD" }), false);
});
