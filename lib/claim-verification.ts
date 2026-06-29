export const contributionVerificationStatuses = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "NEEDS_REVIEW",
] as const;

export const contributionVerificationSources = [
  "MANUAL",
  "EXTERNAL_SYSTEM",
  "IN_APP_REVENUE",
] as const;

export type ContributionVerificationStatus =
  (typeof contributionVerificationStatuses)[number];

export type ContributionVerificationSource =
  (typeof contributionVerificationSources)[number];

export function isContributionVerificationStatus(
  value: string | undefined,
): value is ContributionVerificationStatus {
  return contributionVerificationStatuses.includes(value as ContributionVerificationStatus);
}

export function isContributionVerificationSource(
  value: string | undefined,
): value is ContributionVerificationSource {
  return contributionVerificationSources.includes(value as ContributionVerificationSource);
}

export function isContributionVerified(status: ContributionVerificationStatus) {
  return status === "VERIFIED";
}

export function formatContributionVerificationStatus(
  status: ContributionVerificationStatus,
) {
  const labels: Record<ContributionVerificationStatus, string> = {
    PENDING: "Pending verification",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
    NEEDS_REVIEW: "Needs review",
  };

  return labels[status];
}

export function formatContributionVerificationSource(
  source: ContributionVerificationSource,
) {
  const labels: Record<ContributionVerificationSource, string> = {
    MANUAL: "Manual review",
    EXTERNAL_SYSTEM: "External verification system",
    IN_APP_REVENUE: "In-app revenue workflow",
  };

  return labels[source];
}
