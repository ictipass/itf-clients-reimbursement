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
  claimRecommendedAmount: { toString(): string } | null;
  claimRecommendedInWords: string | null;
  paymentScheduleReference: string | null;
  paymentHandoffStatus: ReimbursementPaymentHandoffStatus;
  company: {
    legalName: string;
    itfEmployerNumber: string | null;
    areaOffice: {
      name: string;
    } | null;
  };
};

const paymentScheduleHeaders = [
  "Schedule Reference",
  "Claim Reference",
  "Employer Name",
  "ITF Employer Number",
  "Training Year",
  "Area Office",
  "Bank Name",
  "Account Number",
  "Sort Code",
  "Recommended Amount",
  "Amount In Words",
  "Contribution Receipt Number",
  "Payment Handoff Status",
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

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function amount(value: { toString(): string } | null) {
  return value ? Number(value.toString()).toFixed(2) : "";
}

export function buildReimbursementPaymentScheduleCsv(
  claim: ReimbursementPaymentScheduleClaim,
) {
  const scheduleReference =
    claim.paymentScheduleReference ?? buildReimbursementPaymentScheduleReference(claim);

  const row = [
    scheduleReference,
    claim.reference,
    claim.company.legalName,
    claim.company.itfEmployerNumber,
    claim.claimYear,
    claim.company.areaOffice?.name,
    claim.bankName,
    claim.accountNumber,
    claim.sortCode,
    amount(claim.claimRecommendedAmount),
    claim.claimRecommendedInWords,
    claim.itfReceiptNumber,
    formatReimbursementPaymentHandoffStatus(claim.paymentHandoffStatus),
  ];

  return [
    paymentScheduleHeaders.map(csvCell).join(","),
    row.map(csvCell).join(","),
  ].join("\n");
}

export function buildReimbursementPaymentScheduleFilename(
  claim: Pick<ReimbursementPaymentScheduleClaim, "reference" | "claimYear">,
) {
  return `reimbursement-payment-schedule-${claim.claimYear ?? "unyear"}-${claim.reference}.csv`;
}
