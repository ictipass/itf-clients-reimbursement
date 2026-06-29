export const revenueWorkflowModes = ["EXTERNAL_VERIFICATION", "IN_APP_REVENUE"] as const;

export type RevenueWorkflowMode = (typeof revenueWorkflowModes)[number];

export const DEFAULT_REVENUE_WORKFLOW_MODE =
  "EXTERNAL_VERIFICATION" satisfies RevenueWorkflowMode;

export function formatRevenueWorkflowMode(mode: RevenueWorkflowMode) {
  switch (mode) {
    case "EXTERNAL_VERIFICATION":
      return "External verification / reimbursement-only";
    case "IN_APP_REVENUE":
      return "In-app revenue workflow";
  }
}

export function describeRevenueWorkflowMode(mode: RevenueWorkflowMode) {
  switch (mode) {
    case "EXTERNAL_VERIFICATION":
      return "Registration revenue payment processing is treated as external; claims rely on uploaded contribution/payment evidence and manual verification.";
    case "IN_APP_REVENUE":
      return "The platform manages contribution invoices, Remita/payment records, and internal revenue review queues.";
  }
}

export function assertSupportedRevenueWorkflowMode(
  mode: string,
): asserts mode is RevenueWorkflowMode {
  if (!revenueWorkflowModes.includes(mode as RevenueWorkflowMode)) {
    throw new Error(`Unsupported revenue workflow mode: ${mode}.`);
  }
}

export function usesInAppRevenueWorkflow(mode: RevenueWorkflowMode) {
  return mode === "IN_APP_REVENUE";
}
