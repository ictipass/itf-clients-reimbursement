export function auditVarianceAmount(hqRecommendation: number, auditedCalculation: number) {
  if (!Number.isFinite(hqRecommendation) || !Number.isFinite(auditedCalculation)) {
    throw new Error("The HQ and audit amounts must be valid numbers.");
  }
  const variance = Math.round((auditedCalculation - hqRecommendation) * 100) / 100;
  return variance === 0 ? 0 : variance;
}

export function hasAuditVariance(variance: number | string | { toString(): string } | null | undefined) {
  return variance != null && Math.round(Number(variance.toString()) * 100) !== 0;
}

export function reviewedClaimAmount(input: {
  hqRecommendation: number;
  auditVariance: number;
  reconciledRecommendation?: number | null;
  reconciliationConfirmed?: boolean;
}) {
  if (!hasAuditVariance(input.auditVariance)) return input.hqRecommendation;
  if (!input.reconciliationConfirmed || input.reconciledRecommendation == null ||
    !Number.isFinite(input.reconciledRecommendation)) {
    throw new Error("The Head of Reimbursement Division must confirm a revised computation table before audit clearance.");
  }
  return input.reconciledRecommendation;
}
