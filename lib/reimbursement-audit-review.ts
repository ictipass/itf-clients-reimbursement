export const reimbursementAuditReviewStatuses = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "VERIFIED",
  "CLEARED",
] as const;

export type ReimbursementAuditReviewStatus =
  (typeof reimbursementAuditReviewStatuses)[number];

export function isReimbursementAuditReviewStatus(
  value: string | undefined,
): value is ReimbursementAuditReviewStatus {
  return reimbursementAuditReviewStatuses.includes(
    value as ReimbursementAuditReviewStatus,
  );
}

export function formatReimbursementAuditReviewStatus(
  status: ReimbursementAuditReviewStatus,
) {
  const labels: Record<ReimbursementAuditReviewStatus, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    RETURNED: "Returned",
    VERIFIED: "Verified",
    CLEARED: "Cleared",
  };

  return labels[status];
}
