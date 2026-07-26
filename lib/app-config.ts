export const contributionFeatureEnabled =
  process.env.NEXT_PUBLIC_CONTRIBUTION_ENABLED !== "false";

export const supportGuidePath = "docs/user-support-guide.md";

export const contributionModeLabel = contributionFeatureEnabled
  ? "integrated contribution and reimbursement"
  : "reimbursement-focused";
