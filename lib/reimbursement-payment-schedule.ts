import ExcelJS from "exceljs";

export const reimbursementPaymentHandoffStatuses = [
  "NOT_READY",
  "READY_FOR_EXPORT",
  "EXPORTED",
  "SENT_TO_PAYMENT_SYSTEM",
  "PV_RAISED",
  "PV_CHECKED",
  "AUDIT_CLEARED",
  "PAID",
  "FAILED",
] as const;

export type ReimbursementPaymentHandoffStatus =
  (typeof reimbursementPaymentHandoffStatuses)[number];

export function canDownloadEpaymentSchedule(input: {
  exportedAt: Date | null;
  exportedById: string | null;
  reference: string | null;
  requesterId: string | null;
  requesterRole: string;
  deskAssignments: { assignedRole: string | null; updatedAt: Date }[];
}) {
  const exportedAt = input.exportedAt;
  if (!exportedAt || !input.exportedById || !input.reference || !input.requesterId) return false;
  if (input.requesterId === input.exportedById && input.requesterRole === "REIMBURSEMENT_ACCOUNTANT") return true;
  return input.deskAssignments.some((assignment) =>
    assignment.assignedRole !== "REIMBURSEMENT_ACCOUNTANT" &&
    assignment.assignedRole === input.requesterRole &&
    assignment.updatedAt >= exportedAt
  );
}

export function isReimbursementPaymentHandoffStatus(
  value: string | undefined,
): value is ReimbursementPaymentHandoffStatus {
  return reimbursementPaymentHandoffStatuses.includes(
    value as ReimbursementPaymentHandoffStatus,
  );
}

export type ReimbursementPaymentScheduleClaim = {
  reference: string;
  claimYear: number | null;
  itfReceiptNumber: string | null;
  bankName: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  paymentAccountType: string | null;
  paymentWithholdingTax: { toString(): string } | null;
  paymentTaxOffset: { toString(): string } | null;
  claimRecommendedAmount: { toString(): string } | null;
  claimRecommendedInWords: string | null;
  paymentScheduleReference: string | null;
  paymentHandoffStatus: ReimbursementPaymentHandoffStatus;
  company: {
    legalName: string;
    email: string | null;
    telephone: string | null;
    itfEmployerNumber: string | null;
    areaOffice: {
      name: string;
    } | null;
  };
};

const paymentScheduleHeaders = [
  "Bank Code",
  "Account Number",
  "Account Type",
  "Payable Amount",
  "Short Description",
  "Long Description",
  "Name",
  "Bank",
  "Mobile Number",
  "Email",
  "WHT",
  "Tax Off",
] as const;

export function formatReimbursementPaymentHandoffStatus(
  status: ReimbursementPaymentHandoffStatus,
) {
  const labels: Record<ReimbursementPaymentHandoffStatus, string> = {
    NOT_READY: "Not ready",
    READY_FOR_EXPORT: "Ready for export",
    EXPORTED: "Exported",
    SENT_TO_PAYMENT_SYSTEM: "Sent to payment system",
    PV_RAISED: "PV raised",
    PV_CHECKED: "PV checked",
    AUDIT_CLEARED: "Audit cleared",
    PAID: "Paid",
    FAILED: "Failed",
  };

  return labels[status];
}

export function buildReimbursementPaymentScheduleReference(
  claim: Pick<ReimbursementPaymentScheduleClaim, "reference" | "claimYear">,
) {
  return `ITF-RMB-${claim.claimYear ?? "UNYEAR"}-${claim.reference}`;
}

export function validateReimbursementPaymentSchedule(
  claim: ReimbursementPaymentScheduleClaim,
) {
  if (!claim.sortCode || !claim.accountNumber || !claim.bankName) throw new Error("Complete the beneficiary's bank details before creating the e-payment schedule.");
  if (!claim.paymentAccountType?.trim()) throw new Error("Enter the beneficiary account type before creating the e-payment schedule.");
  if (!claim.company.telephone || !claim.company.email) throw new Error("The company must have a telephone number and email before creating the e-payment schedule.");
  if (claim.paymentWithholdingTax === null || claim.paymentTaxOffset === null) throw new Error("The accountant must confirm WHT and Tax Off, including zero values.");
  const approved = Number(claim.claimRecommendedAmount?.toString());
  const wht = Number(claim.paymentWithholdingTax?.toString());
  const taxOff = Number(claim.paymentTaxOffset?.toString());
  if (!Number.isFinite(approved) || approved <= 0) throw new Error("An approved claim amount is required for the e-payment schedule.");
  if (!Number.isFinite(wht) || !Number.isFinite(taxOff) || wht < 0 || taxOff < 0 || wht + taxOff > approved) {
    throw new Error("WHT and Tax Off must be valid, non-negative amounts that do not exceed the approved award.");
  }
  if ([wht, taxOff].some((value) => Math.abs(value * 100 - Math.round(value * 100)) > 0.000001)) {
    throw new Error("WHT and Tax Off must have no more than two decimal places.");
  }
  if (wht + taxOff === approved) throw new Error("Payable Amount must be greater than zero.");
  return { approved, wht, taxOff, payable: Math.round((approved - wht - taxOff) * 100) / 100 };
}

export async function buildReimbursementPaymentScheduleWorkbook(claim: ReimbursementPaymentScheduleClaim) {
  const amounts = validateReimbursementPaymentSchedule(claim);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("E-Payment Schedule");
  sheet.addRow([...paymentScheduleHeaders]);
  sheet.addRow([
    claim.sortCode,
    claim.accountNumber,
    claim.paymentAccountType,
    amounts.payable,
    `ITF reimbursement ${claim.reference}`,
    `ITF reimbursement claim ${claim.reference}; training year ${claim.claimYear ?? "not recorded"}; schedule ${claim.paymentScheduleReference ?? buildReimbursementPaymentScheduleReference(claim)}`,
    claim.company.legalName,
    claim.bankName,
    claim.company.telephone,
    claim.company.email,
    amounts.wht,
    amounts.taxOff,
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).numFmt = "@";
  sheet.getColumn(2).numFmt = "@";
  for (const index of [4, 11, 12]) sheet.getColumn(index).numFmt = "#,##0.00";
  sheet.columns.forEach((column) => { column.width = 22; });
  return workbook.xlsx.writeBuffer();
}

export function buildReimbursementPaymentScheduleFilename(
  claim: Pick<ReimbursementPaymentScheduleClaim, "reference" | "claimYear">,
) {
  return `reimbursement-payment-schedule-${claim.claimYear ?? "unyear"}-${claim.reference}.xlsx`;
}
