import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont } from "pdf-lib";

type ArchivedHqComputation = {
  companyName?: string;
  itfEmployerNumber?: string | null;
  claimYear?: number | null;
  contributionPaid?: string;
  receiptNumber?: string | null;
  fiftyPercentOfContribution?: string;
  areaOfficeName?: string | null;
  amountRecommended: string;
  amountRecommendedInWords?: string | null;
  recommendedContributionPercent: string | null;
  preparedBy?: string | null;
  preparedAt?: string | null;
  confirmedBy: string | null;
  confirmedAt?: string | null;
  rows: {
    emphasis?: number | null;
    area: string;
    totalEmployees?: number | null;
    numberTrained?: number | null;
    percentTrained?: string | null;
    maxPercentClaimable?: string | null;
    percentTrainingContributionAwarded?: string | null;
    equivalentContribution: string | null;
    expenditureClaimed: string | null;
    awarded: string | null;
    remarks: string | null;
  }[];
};

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
  hqComputation?: ArchivedHqComputation | null;
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
  if (packet.hqComputation) {
    y -= 8;
    write("HQ COMPUTATION TABLE", true);
    write(`Recommendation: NGN ${packet.hqComputation.amountRecommended} | Confirmed by: ${packet.hqComputation.confirmedBy ?? "Pending"}`);
    write("The complete 11-column computation sheet follows on a landscape page.");
  }
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
  if (packet.hqComputation) appendHqComputationSheet(pdf, packet, packet.hqComputation, regular, bold);
  if (voucherPdf) {
    const voucher = await PDFDocument.load(voucherPdf);
    for (const copied of await pdf.copyPages(voucher, voucher.getPageIndices())) pdf.addPage(copied);
  }
  return pdf.save();
}

function appendHqComputationSheet(
  pdf: PDFDocument,
  packet: ArchivedPaymentPacket,
  table: ArchivedHqComputation,
  regular: PDFFont,
  bold: PDFFont,
) {
  const pageWidth = 1191;
  const pageHeight = 842;
  const left = 44;
  const columns = [
    { label: "Emphasis", width: 55 },
    { label: "Area of training", width: 170 },
    { label: "Total no. of employees", width: 83 },
    { label: "No. trained", width: 70 },
    { label: "% trained", width: 73 },
    { label: "Max % claimable", width: 77 },
    { label: "% training contribution awarded", width: 105 },
    { label: "(A) Equivalent amount of contribution", width: 112 },
    { label: "(B) Expenditure claimed", width: 104 },
    { label: "(C) Amount awarded (lower of A or B)", width: 104 },
    { label: "Remarks", width: 145 },
  ];
  const fullWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const border = rgb(0.73, 0.76, 0.8);
  const ink = rgb(0.12, 0.16, 0.2);
  const printable = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = 800;

  function wrap(value: string, width: number, font: PDFFont, size: number) {
    const lines: string[] = [];
    let line = "";
    for (const word of printable(value).trim().split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : ["-"];
  }

  function drawCell(x: number, top: number, width: number, height: number, lines: string[], font: PDFFont, size: number, shaded = false) {
    page.drawRectangle({ x, y: top - height, width, height, borderColor: border, borderWidth: 0.5,
      color: shaded ? rgb(0.95, 0.96, 0.97) : rgb(1, 1, 1) });
    for (let index = 0; index < lines.length; index += 1) {
      page.drawText(lines[index], { x: x + 4, y: top - 12 - index * 10, font, size, color: ink });
    }
  }

  function startPage(continued = false) {
    if (continued) page = pdf.addPage([pageWidth, pageHeight]);
    y = 800;
    page.drawText(`COMPUTATION OF EMPLOYER'S REIMBURSEMENT${continued ? " (continued)" : ""}`,
      { x: left, y, font: bold, size: 14, color: ink });
    y -= 23;
    const details = [
      `Training year: ${table.claimYear ?? packet.claimYear ?? "Not recorded"} | Company: ${table.companyName ?? packet.companyName} | ITF reg. no.: ${table.itfEmployerNumber ?? "Not recorded"}`,
      `Area office: ${table.areaOfficeName ?? packet.areaOffice ?? "Not assigned"} | Contribution paid: NGN ${table.contributionPaid ?? "Not captured"} | Receipt no.: ${table.receiptNumber ?? "Not recorded"}`,
      `50% of contribution: NGN ${table.fiftyPercentOfContribution ?? "Not captured"}`,
    ];
    for (const detail of details) {
      const lines = wrap(detail, fullWidth, regular, 9);
      for (const line of lines) { page.drawText(line, { x: left, y, font: regular, size: 9, color: ink }); y -= 13; }
    }
    if (table.rows.some((row) => row.emphasis === undefined)) {
      page.drawText("Legacy archive: fields not captured when this packet was archived display as N/A.",
        { x: left, y, font: regular, size: 8, color: ink });
      y -= 17;
    }
    y -= 8;
    let x = left;
    for (const column of columns) {
      drawCell(x, y, column.width, 58, wrap(column.label, column.width - 8, bold, 8), bold, 8, true);
      x += column.width;
    }
    y -= 58;
  }

  startPage();
  for (const row of table.rows) {
    const values = [
      row.emphasis?.toString() ?? "N/A", row.area,
      row.totalEmployees?.toString() ?? "N/A", row.numberTrained?.toString() ?? "N/A",
      row.percentTrained == null ? "N/A" : `${row.percentTrained}%`,
      row.maxPercentClaimable == null ? "N/A" : `${row.maxPercentClaimable}%`,
      row.percentTrainingContributionAwarded == null ? "N/A" : `${row.percentTrainingContributionAwarded}%`,
      row.equivalentContribution ?? "N/A", row.expenditureClaimed ?? "N/A",
      row.awarded ?? "N/A", row.remarks ?? "-",
    ];
    const wrapped = values.map((value, index) => wrap(value, columns[index].width - 8, regular, 8));
    const height = Math.max(27, ...wrapped.map((lines) => 10 + lines.length * 10));
    if (y - height < 145) startPage(true);
    let x = left;
    for (let index = 0; index < columns.length; index += 1) {
      drawCell(x, y, columns[index].width, height, wrapped[index], regular, 8);
      x += columns[index].width;
    }
    y -= height;
  }

  if (y < 145) startPage(true);
  const totalLabelWidth = columns.slice(0, 9).reduce((sum, column) => sum + column.width, 0);
  drawCell(left, y, totalLabelWidth, 28, ["TOTAL RECOMMENDED"], bold, 8, true);
  drawCell(left + totalLabelWidth, y, columns[9].width, 28, [`NGN ${table.amountRecommended}`], bold, 8, true);
  drawCell(left + totalLabelWidth + columns[9].width, y, columns[10].width, 28, [""], regular, 8, true);
  y -= 43;
  const rowTotal = table.rows.reduce((sum, row) => sum + Number(row.awarded ?? 0), 0);
  const capAdjustment = Math.round((Number(table.amountRecommended) - rowTotal) * 100) / 100;
  const footer = [
    `HQ amount recommended (in words): ${table.amountRecommendedInWords ?? "Not captured in archived computation"}`,
    `Percentage of training contribution recommended: ${table.recommendedContributionPercent ?? "N/A"}% (NGN ${table.amountRecommended})`,
    ...(capAdjustment < 0 ? [`8th edition 50% contribution cap adjustment: NGN ${capAdjustment.toFixed(2)}`] : []),
    `Prepared by HQ RO: ${table.preparedBy ?? "Not recorded"}${table.preparedAt ? ` | ${table.preparedAt}` : ""}`,
    `Confirmed by Head of Division: ${table.confirmedBy ?? "Pending"}${table.confirmedAt ? ` | ${table.confirmedAt}` : ""}`,
  ];
  for (const detail of footer) {
    for (const line of wrap(detail, fullWidth, regular, 9)) {
      if (y < 40) { startPage(true); }
      page.drawText(line, { x: left, y, font: regular, size: 9, color: ink });
      y -= 14;
    }
  }
}
