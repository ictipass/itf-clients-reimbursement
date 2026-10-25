import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

import { buildArchivedPaymentPacketPdf, parseArchivedPaymentPacket } from "../lib/reimbursement-archive-packet";
import { canRecordVoucherSignoff, requiredVoucherSignoffForHandoff } from "../lib/reimbursement-voucher-signoffs";
import { buildPaymentVoucherPdf } from "../lib/reimbursement-payment-voucher";

test("new voucher clearances are restricted to the current officer and review stage", () => {
  const base = {
    kind: "PV_CHECKED" as const, role: "HEAD_REIMBURSEMENT_FINANCE" as const,
    desk: "HEAD_REIMBURSEMENT_FINANCE", signoffRequired: true,
    signedKinds: ["PV_PREPARED" as const], paymentVoucherRaised: true,
    paymentFileAuditStatus: null,
  };
  assert.equal(canRecordVoucherSignoff(base), true);
  assert.equal(canRecordVoucherSignoff({ ...base, desk: "HEAD_BUDGET" }), false);
  assert.equal(canRecordVoucherSignoff({ ...base, signedKinds: [] }), false);
  assert.equal(canRecordVoucherSignoff({ ...base, signoffRequired: false }), false);
  assert.equal(requiredVoucherSignoffForHandoff("HEAD_REIMBURSEMENT_FINANCE", "HEAD_BUDGET"), "PV_CHECKED");
  assert.equal(requiredVoucherSignoffForHandoff("HEAD_PRE_AUDIT", "HEAD_REIMBURSEMENT_FINANCE"), "PRE_AUDIT_VERIFIED");
});

test("archived packet PDF includes its voucher and linked evidence index", async () => {
  const voucher = await buildPaymentVoucherPdf({
    reference: "CLM-001", claimYear: 2026, bankName: "Example Bank", accountNumber: "0123456789",
    claimRecommendedAmount: "1500000", claimRecommendedInWords: "One million five hundred thousand naira",
    company: { legalName: "Ada Training Ltd", businessAddress: "Abuja" },
  }, new Date("2026-10-25T10:00:00Z"), "Accountant One", [
    { kind: "BUDGET_CLEARED", officer: "Budget Officer", signedAt: new Date("2026-10-25T11:00:00Z") },
  ]);
  const snapshot = {
    version: 1, archivedAt: "2026-10-25T12:00:00Z", reference: "CLM-001", claimYear: 2026,
    companyName: "Ada Training Ltd", companyAddress: "Abuja", areaOffice: "Abuja",
    approvedAmount: "1500000", amountInWords: "One million five hundred thousand naira",
    scheduleReference: "EPS-001", withholdingTax: "0", taxOffset: "0", bankName: "Example Bank",
    accountNumber: "0123456789", accountNumberLast4: "6789", paymentReference: "PAY-001",
    voucherRaised: "2026-10-25T10:00:00Z", voucherPreparedBy: "Accountant One",
    signoffs: [{ kind: "BUDGET_CLEARED", officer: "Budget Officer", role: "BUDGET_OFFICER", amount: "1500000", remark: "Cleared", signedAt: "2026-10-25T11:00:00Z" }],
    evidence: [{ id: "doc-1", kind: "PAYMENT_RECEIPT", fileName: "receipt.pdf", uploadedAt: "2026-10-25T11:30:00Z" }],
    decisions: [{ action: "SETTLE", reason: "Payment recorded", officer: "Accountant One", at: "2026-10-25T12:00:00Z" }],
  };
  const packet = parseArchivedPaymentPacket(snapshot);
  assert.ok(packet);
  const bytes = await buildArchivedPaymentPacketPdf(packet, "https://example.test/registry/company-1/evidence", voucher);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 2);
  assert.ok(bytes.length > voucher.length);
  assert.equal(parseArchivedPaymentPacket({ version: 1 }), null);
});
