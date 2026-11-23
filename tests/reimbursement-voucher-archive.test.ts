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

test("archived packet renders the complete HQ computation on a landscape page", async () => {
  const packet = parseArchivedPaymentPacket({
    version: 1, archivedAt: "2026-10-25T12:00:00Z", reference: "CLM-002", claimYear: 2025,
    companyName: "Ada Training Ltd", areaOffice: "Abuja", approvedAmount: "50000",
    amountInWords: "Fifty thousand naira", companyAddress: "Abuja", scheduleReference: null,
    withholdingTax: null, taxOffset: null, bankName: null, accountNumber: null,
    accountNumberLast4: null, paymentReference: null, voucherRaised: null, voucherPreparedBy: null,
    signoffs: [], evidence: [], decisions: [],
    hqComputation: {
      companyName: "Ada Training Ltd", itfEmployerNumber: "ITF-123", claimYear: 2025,
      contributionPaid: "200000", receiptNumber: "R-001", fiftyPercentOfContribution: "100000",
      areaOfficeName: "Abuja", amountRecommended: "50000", amountRecommendedInWords: "Fifty thousand naira",
      recommendedContributionPercent: "25", preparedBy: "HQ Officer", preparedAt: "2026-10-24T10:00:00Z",
      confirmedBy: "Head of Division", confirmedAt: "2026-10-25T10:00:00Z",
      rows: [{
        emphasis: 1, area: "Management", totalEmployees: 100, numberTrained: 25,
        percentTrained: "25", maxPercentClaimable: "15", percentTrainingContributionAwarded: "15",
        equivalentContribution: "30000", expenditureClaimed: "20000", awarded: "20000",
        remarks: "Verified supporting evidence and training expenditure for this area.",
      }, {
        emphasis: 2, area: "Supervisory", totalEmployees: 75, numberTrained: 30,
        percentTrained: "40", maxPercentClaimable: "13", percentTrainingContributionAwarded: "13",
        equivalentContribution: "26000", expenditureClaimed: "30000", awarded: "26000",
        remarks: "Long reviewer note ".repeat(25),
      }],
    },
  });
  assert.ok(packet);
  const bytes = await buildArchivedPaymentPacketPdf(packet, "https://example.test/registry/company-1/evidence");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  assert.ok(pdf.getPages()[1].getWidth() > pdf.getPages()[1].getHeight());

  // Existing snapshots contain only A/B/C. They remain downloadable without inventing missing values.
  const legacy = parseArchivedPaymentPacket({ ...packet, hqComputation: {
    amountRecommended: "50000", recommendedContributionPercent: "25", confirmedBy: null,
    rows: [{ area: "Management", equivalentContribution: "30000", expenditureClaimed: "20000", awarded: "20000", remarks: null }],
  } });
  assert.ok(legacy);
  const oldPdf = await PDFDocument.load(await buildArchivedPaymentPacketPdf(legacy, "https://example.test/registry/company-1/evidence"));
  assert.equal(oldPdf.getPageCount(), 2);
});

test("archived packet renders the original award explanation and later addenda separately", async () => {
  const note = { kind: "HQ_REVIEW", officer: "Original HQ RO", role: "HQ_REIMBURSEMENT_OFFICER",
    narrative: "Verified expenditure and attendance. ".repeat(45), evidenceDocumentId: "doc-1",
    priorAmount: "450", reviewedAmount: "420", policyEdition: "EIGHTH_REVISED", at: "2026-10-24T10:00:00Z" };
  const packet = parseArchivedPaymentPacket({
    version: 1, archivedAt: "2026-10-25T12:00:00Z", reference: "CLM-003", claimYear: 2025,
    companyName: "Ada Training Ltd", areaOffice: "Abuja", approvedAmount: "420",
    amountInWords: "Four hundred and twenty naira", companyAddress: "Abuja", scheduleReference: null,
    withholdingTax: null, taxOffset: null, bankName: null, accountNumber: null,
    accountNumberLast4: null, paymentReference: null, voucherRaised: null, voucherPreparedBy: null,
    signoffs: [], evidence: [], decisions: [],
    awardExplanation: { policyEdition: "EIGHTH_REVISED", bridge: [
      { label: "Employer claimed", amount: 1000, change: null },
      { label: "Final approved award", amount: 420, change: -580 },
    ], notes: [note] },
  });
  assert.ok(packet);
  const pdf = await PDFDocument.load(await buildArchivedPaymentPacketPdf(packet,
    "https://example.test/registry/company-1/evidence", undefined,
    [{ ...note, kind: "ARCHIVE_ADDENDUM", officer: "Successor Head", at: "2031-01-01T12:00:00Z" }]));
  assert.ok(pdf.getPageCount() >= 2);
});
