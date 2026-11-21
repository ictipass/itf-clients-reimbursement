export const reimbursementPolicyEditions = ["EIGHTH_REVISED"] as const;

export type ReimbursementPolicyEdition = (typeof reimbursementPolicyEditions)[number];

export const DEFAULT_REIMBURSEMENT_POLICY_EDITION =
  "EIGHTH_REVISED" satisfies ReimbursementPolicyEdition;

// An implementation key identifies the reviewed calculator shipped with this edition.
// A new policy must receive a new enum value, calculator branch, tests, and key;
// changing this key alone must never be used to change existing claims' rules.
export const reimbursementPolicyDefinitions = {
  EIGHTH_REVISED: {
    label: "8th Revised Reimbursement Edition",
    implementationKey: "EIGHTH_REVISED_V1",
  },
} as const satisfies Record<
  ReimbursementPolicyEdition,
  { label: string; implementationKey: string }
>;

export function formatReimbursementPolicyEdition(edition: ReimbursementPolicyEdition) {
  return reimbursementPolicyDefinitions[edition].label;
}

export function assertSupportedReimbursementPolicyEdition(
  edition: string,
): asserts edition is ReimbursementPolicyEdition {
  if (!reimbursementPolicyEditions.includes(edition as ReimbursementPolicyEdition)) {
    throw new Error(`Unsupported reimbursement policy edition: ${edition}.`);
  }
}

export function getReimbursementPolicyDefinition(edition: string) {
  assertSupportedReimbursementPolicyEdition(edition);
  return reimbursementPolicyDefinitions[edition];
}

export function validatePolicyActivation(input: {
  requesterRole: string;
  edition: string;
  currentEdition: ReimbursementPolicyEdition;
  lastActivatedEdition: ReimbursementPolicyEdition | null;
  approvalReference: string;
  approvalConfirmed: boolean;
}) {
  if (input.requesterRole !== "SYSTEM_ADMIN" && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
    throw new Error("Only an administrator can record or activate a reimbursement policy.");
  }

  const definition = getReimbursementPolicyDefinition(input.edition);
  const approvalReference = input.approvalReference.trim();
  if (approvalReference.length < 5 || approvalReference.length > 200) {
    throw new Error("Enter the formal policy approval reference (5–200 characters).");
  }
  if (!input.approvalConfirmed) {
    throw new Error("Confirm that this policy edition has formal approval before activating it.");
  }
  if (input.edition === input.currentEdition && input.lastActivatedEdition !== null) {
    throw new Error("This policy edition is already active and its approval has been recorded.");
  }

  return { edition: input.edition as ReimbursementPolicyEdition, approvalReference, implementationKey: definition.implementationKey };
}
