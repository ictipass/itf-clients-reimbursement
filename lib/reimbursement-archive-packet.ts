import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

export type ArchivedPaymentPacket = {
  version: number;
  archivedAt: string;
  reference: string;
  claimYear: number | null;
  companyName: string;
  areaOffice: string | null;
  approvedAmount: string | null;
  amountInWords: string | null;
  companyAddress: string | null;
  scheduleReference: string | null;
  withholdingTax: string | null;
  taxOffset: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountNumberLast4: string | null;
  paymentReference: string | null;
  voucherRaised: string | null;
  voucherPreparedBy: string | null;
  signoffs: { kind: string; officer: string; role: string; amount: string; remark: string | null; signedAt: string }[];
  evidence: { id: string; kind: string; fileName: string; uploadedAt: string }[];
  trainings?: { id: string; title: string; approvalReference: string | null }[];
  decisions: { action: string; reason: string | null; officer: string; at: string }[];
};

export function parseArchivedPaymentPacket(value: unknown): ArchivedPaymentPacket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.reference !== "string" || typeof record.companyName !== "string" ||
    !Array.isArray(record.signoffs) || !Array.isArray(record.evidence) || !Array.isArray(record.decisions)) return null;
  return value as ArchivedPaymentPacket;
}

export async function buildArchivedPaymentPacketPdf(packet: ArchivedPaymentPacket, evidenceBaseUrl: string, voucherPdf?: Uint8Array) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 795;
  const safe = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
  const write = (value: string, heading = false, link?: string) => {
    const size = heading ? 11 : 8;
    if (y < 52) { page = pdf.addPage([595, 842]); y = 795; }
    const text = safe(value).slice(0, 122);
    page.drawText(text, { x: 42, y, size, font: heading ? bold : regular, color: rgb(0.12, 0.16, 0.2) });
    if (link) {
      page.node.addAnnot(pdf.context.register(pdf.context.obj({
        Type: PDFName.of("Annot"), Subtype: PDFName.of("Link"),
        Rect: [42, y - 2, 553, y + 12], Border: [0, 0, 0],
        A: { S: PDFName.of("URI"), URI: PDFString.of(link) },
      })));
    }
    y -= heading ? 21 : 14;
  };
  write("ITF REIMBURSEMENT - ARCHIVED PAYMENT PACKET", true);
  write(`Claim ${packet.reference} | Archived ${packet.archivedAt}`);
  write(`Employer: ${packet.companyName} | Area office: ${packet.areaOffice ?? "Unassigned"}`);
  write(`Training year: ${packet.claimYear ?? "Not recorded"} | Approved award: NGN ${packet.approvedAmount ?? "Not recorded"}`);
  write(`Payment reference: ${packet.paymentReference ?? "Not recorded"} | Schedule: ${packet.scheduleReference ?? "Not created"}`);
  write(`Bank: ${packet.bankName ?? "Not recorded"} | Account ending: ${packet.accountNumberLast4 ?? "Not recorded"}`);
  write(`WHT: NGN ${packet.withholdingTax ?? "0"} | Tax Off: NGN ${packet.taxOffset ?? "0"}`);
  y -= 8;
  write("VOUCHER CLEARANCES AND PAYMENT RECORD", true);
  if (!packet.signoffs.length) write("Legacy packet: electronic clearance attestations were not recorded.");
  for (const signoff of packet.signoffs) {
    write(`${signoff.kind.replaceAll("_", " ")} | ${signoff.officer} (${signoff.role.replaceAll("_", " ")})`);
    write(`NGN ${signoff.amount} | ${signoff.signedAt} | ${signoff.remark ?? "No remark"}`);
  }
  y -= 8;
  write("EVIDENCE INDEX", true);
  write("Select an evidence row to open the original file. ITF login and claim access are required.");
  for (const evidence of packet.evidence) write(`${evidence.kind.replaceAll("_", " ")} | ${evidence.fileName} | ${evidence.uploadedAt}`,
    false, `${evidenceBaseUrl}/${encodeURIComponent(evidence.id)}?disposition=inline`);
  if (packet.trainings?.length) {
    y -= 8;
    write("ATTACHED APPROVED TRAININGS", true);
    const siteOrigin = new URL(evidenceBaseUrl).origin;
    for (const training of packet.trainings) write(`${training.approvalReference ?? "Training"} | ${training.title}`,
      false, `${siteOrigin}/training-requests/${encodeURIComponent(training.id)}`);
  }
  y -= 8;
  write("DECISION TRAIL", true);
  for (const decision of packet.decisions) {
    write(`${decision.at} | ${decision.officer} | ${decision.action}`);
    if (decision.reason) write(decision.reason);
  }
  if (voucherPdf) {
    const voucher = await PDFDocument.load(voucherPdf);
    for (const copied of await pdf.copyPages(voucher, voucher.getPageIndices())) pdf.addPage(copied);
  }
  return pdf.save();
}
