import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PaymentVoucherClaim = {
  reference: string;
  claimYear: number | null;
  bankName: string | null;
  accountNumber: string | null;
  claimRecommendedAmount: { toString(): string } | null;
  claimRecommendedInWords: string | null;
  company: { legalName: string; businessAddress: string | null };
};

export function paymentVoucherReference(claim: Pick<PaymentVoucherClaim, "reference">) {
  return `PV-${claim.reference}`;
}

export function paymentVoucherFilename(claim: Pick<PaymentVoucherClaim, "reference">) {
  return `payment-voucher-${claim.reference}.pdf`;
}

export function canDownloadPaymentVoucher(input: {
  raisedAt: Date | null;
  raisedById: string | null;
  requesterId: string | null;
  requesterRole: string;
  deskAssignments: { assignedRole: string | null; updatedAt: Date }[];
}) {
  if (!input.raisedAt || !input.raisedById || !input.requesterId) return false;
  if (input.requesterId === input.raisedById && input.requesterRole === "REIMBURSEMENT_ACCOUNTANT") return true;
  return input.deskAssignments.some((item) => item.assignedRole === input.requesterRole && item.updatedAt >= input.raisedAt!);
}

export async function buildPaymentVoucherPdf(claim: PaymentVoucherClaim, raisedAt: Date, preparedBy: string, signoffs: { kind: string; officer: string; signedAt: Date }[] = []) {
  const amount = Number(claim.claimRecommendedAmount?.toString());
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("The approved award amount is missing from the payment voucher.");
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.16, 0.2);
  const text = (value: string | null | undefined, x: number, y: number, size = 9, strong = false, max = 95) => {
    const safe = (value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").slice(0, max);
    page.drawText(safe, { x, y, size, font: strong ? bold : regular, color: ink });
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.7, color: ink });
  const box = (x: number, y: number, width: number, height: number) => page.drawRectangle({ x, y, width, height, borderColor: ink, borderWidth: 0.7 });
  const date = raisedAt.toISOString().slice(0, 10);
  const money = amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  text("INDUSTRIAL TRAINING FUND", 42, 798, 12, true);
  text("BANK PAYMENT VOUCHER", 202, 770, 15, true);
  text(`PV No: ${paymentVoucherReference(claim)}`, 42, 744, 10, true);
  text("Departmental code: pending finance coding", 42, 732, 7);
  text(`Date raised: ${date}`, 390, 744, 10);
  box(42, 625, 511, 103);
  line(42, 692, 553, 692); line(42, 660, 553, 660);
  text("Name of payee", 50, 711, 8, true); text(claim.company.legalName, 144, 711, 10, false, 43);
  text("Staff no.", 405, 711, 8); text("N/A", 465, 711, 9);
  text("Address", 50, 676, 8, true); text(claim.company.businessAddress ?? "Not recorded", 144, 676, 9, false, 68);
  text("Department", 50, 642, 8, true); text("Reimbursement", 144, 642, 9);
  text("Particulars of payment", 42, 602, 10, true);
  box(42, 526, 511, 65);
  text(`Reimbursement award for training year ${claim.claimYear ?? "not recorded"}`, 50, 566, 10);
  text(`Claim: ${claim.reference}`, 50, 544, 9);
  text(`Approved amount: NGN ${money}`, 344, 544, 9, true);
  box(42, 488, 511, 29); line(250, 488, 250, 517); line(425, 488, 425, 517);
  text("PAYING BANK", 48, 506, 7, true); text(claim.bankName ?? "Not recorded", 48, 493, 9, false, 32);
  text("BANK A/C NO.", 256, 506, 7, true); text(claim.accountNumber ?? "Not recorded", 256, 493, 9);
  text("PV NO.", 431, 506, 7, true); text(paymentVoucherReference(claim), 431, 493, 9);
  box(42, 448, 511, 31);
  text("Amount in words", 49, 466, 8, true); text(claim.claimRecommendedInWords ?? "See approved award amount", 139, 457, 8, false, 75);
  box(42, 405, 511, 34); line(245, 405, 245, 439); line(395, 405, 395, 439);
  text("PREPARED BY", 48, 426, 7, true); text(preparedBy, 48, 411, 9, false, 36);
  text("CODED BY", 251, 426, 7, true); text("Pending finance coding", 251, 411, 8);
  text("CHECKED BY", 401, 426, 7, true); text(signoffs.find((item) => item.kind === "PV_CHECKED")?.officer ?? "Awaiting check", 401, 411, 8, false, 24);
  box(42, 231, 511, 165);
  line(42, 372, 553, 372); line(42, 256, 553, 256);
  for (const x of [220, 290, 338, 418, 498]) line(x, 231, x, 396);
  text("Account particulars", 48, 380, 7, true); text("Account no.", 226, 380, 7, true);
  text("Ref no.", 296, 380, 7, true); text("Debit (NGN)", 344, 380, 7, true);
  text("Credit", 424, 380, 7, true); text("Year", 504, 380, 7, true);
  text("Reimbursement award", 48, 350, 9);
  text(claim.accountNumber ?? "", 226, 350, 8);
  text(claim.reference, 296, 350, 7, false, 13);
  text(money, 344, 350, 9); text(String(claim.claimYear ?? ""), 504, 350, 8);
  text("TOTAL", 48, 241, 9, true); text(money, 344, 241, 9, true);
  const clearances = ["BUDGET CLEARANCE", "AUDIT CLEARANCE", "APPROVAL FOR PAYMENT", "PAYMENT RECORDED"];
  const clearanceKinds = ["BUDGET_CLEARED", "PRE_AUDIT_CLEARED", "PAYMENT_APPROVED", "PAYMENT_RECORDED"];
  for (let i = 0; i < 4; i++) {
    const x = 42 + i * 127.75;
    const signed = signoffs.find((item) => item.kind === clearanceKinds[i]);
    box(x, 77, 127.75, 145);
    text(clearances[i], x + 5, 205, 7, true, 24);
    text(`Amount: NGN ${money}`, x + 5, 182, 7);
    text(`Name: ${signed?.officer ?? "Pending"}`, x + 5, 156, 7, false, 27);
    text(`Attested: ${signed ? "Electronic" : "Pending"}`, x + 5, 127, 7);
    text(`Date: ${signed?.signedAt.toISOString().slice(0, 10) ?? "Pending"}`, x + 5, 98, 7);
  }
  text("Electronic attestations are recorded with authenticated officer, role and time in the claim audit trail.", 42, 56, 7);
  return document.save();
}
