export const reimbursementPolicyEditions = ["EIGHTH_REVISED"] as const;

export type ReimbursementPolicyEdition = (typeof reimbursementPolicyEditions)[number];

export const DEFAULT_REIMBURSEMENT_POLICY_EDITION =
  "EIGHTH_REVISED" satisfies ReimbursementPolicyEdition;

export function formatReimbursementPolicyEdition(edition: ReimbursementPolicyEdition) {
  switch (edition) {
    case "EIGHTH_REVISED":
      return "8th Revised Reimbursement Edition";
  }
}

export function assertSupportedReimbursementPolicyEdition(
  edition: string,
): asserts edition is ReimbursementPolicyEdition {
  if (!reimbursementPolicyEditions.includes(edition as ReimbursementPolicyEdition)) {
    throw new Error(`Unsupported reimbursement policy edition: ${edition}.`);
  }
}
