import { cache } from "react";

import { getDb } from "@/lib/db";

export const revenueWorkflowModes = ["EXTERNAL_VERIFICATION", "IN_APP_REVENUE"] as const;

export type RevenueWorkflowMode = (typeof revenueWorkflowModes)[number];

export const DEFAULT_REVENUE_WORKFLOW_MODE =
  "EXTERNAL_VERIFICATION" satisfies RevenueWorkflowMode;

export function formatRevenueWorkflowMode(mode: RevenueWorkflowMode) {
  switch (mode) {
    case "EXTERNAL_VERIFICATION":
      return "Reimbursement";
    case "IN_APP_REVENUE":
      return "Integrated";
  }
}

export function describeRevenueWorkflowMode(mode: RevenueWorkflowMode) {
  switch (mode) {
    case "EXTERNAL_VERIFICATION":
      return "Employers provide their existing ITF registration number. Annual compliance is verified with the existing compliance platform before training and reimbursement approval.";
    case "IN_APP_REVENUE":
      return "This application manages employer registration, annual contribution and compliance, training, and reimbursement.";
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

export const getActiveRevenueWorkflowMode = cache(async () => {
  const workspace = await getDb().workspace.findFirst({
    where: {
      isActive: true,
    },
    select: {
      revenueWorkflowMode: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return workspace?.revenueWorkflowMode ?? DEFAULT_REVENUE_WORKFLOW_MODE;
});

export async function assertCompanyUsesInAppRevenueWorkflow(companyId: string) {
  const company = await getDb().company.findFirst({
    where: {
      id: companyId,
      recordTier: "HOT",
    },
    select: {
      organization: {
        select: {
          workspace: {
            select: {
              revenueWorkflowMode: true,
            },
          },
        },
      },
    },
  });

  const mode = company?.organization.workspace.revenueWorkflowMode;

  if (!mode || !usesInAppRevenueWorkflow(mode)) {
    throw new Error(
      "The in-app registration revenue workflow is disabled for this workspace.",
    );
  }
}
