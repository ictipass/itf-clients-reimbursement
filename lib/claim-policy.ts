import { getDb } from "@/lib/db";
import { canManageClaimPolicy, type Role } from "@/lib/rbac";
import {
  assertSupportedReimbursementPolicyEdition,
  type ReimbursementPolicyEdition,
} from "@/lib/reimbursement-policy";
import {
  assertSupportedRevenueWorkflowMode,
  type RevenueWorkflowMode,
} from "@/lib/revenue-workflow";

export const CLAIM_SUBMISSION_DEADLINE_NOTICE =
  "ALL TRAINING CLAIMS MUST BE SUBMITTED ON OR BEFORE 30TH JUNE AFTER EACH TRAINING YEAR (JANUARY - DECEMBER)";

export type ClaimPolicyWorkspace = {
  id: string;
  name: string;
  allowLateClaimSubmissions: boolean;
  activeReimbursementEdition: ReimbursementPolicyEdition;
  revenueWorkflowMode: RevenueWorkflowMode;
};

export function getClaimSubmissionDeadline(trainingYear: number) {
  return new Date(Date.UTC(trainingYear + 1, 5, 30, 23, 59, 59, 999));
}

export function isLateClaimSubmission(trainingYear: number, now = new Date()) {
  return now.getTime() > getClaimSubmissionDeadline(trainingYear).getTime();
}

export async function listClaimPolicyWorkspaces(input: { requesterRole: Role }) {
  if (!canManageClaimPolicy(input.requesterRole)) {
    throw new Error("You do not have permission to manage claim submission settings.");
  }

  return getDb().workspace.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      allowLateClaimSubmissions: true,
      activeReimbursementEdition: true,
      revenueWorkflowMode: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function updateClaimSubmissionPolicy(input: {
  requesterRole: Role;
  workspaceId: string;
  allowLateClaimSubmissions: boolean;
  activeReimbursementEdition?: string;
  revenueWorkflowMode?: string;
}) {
  if (!canManageClaimPolicy(input.requesterRole)) {
    throw new Error("You do not have permission to manage claim submission settings.");
  }

  const workspace = await getDb().workspace.findFirst({
    where: {
      id: input.workspaceId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace was not found.");
  }

  let activeReimbursementEdition: ReimbursementPolicyEdition | undefined;
  let revenueWorkflowMode: RevenueWorkflowMode | undefined;

  if (input.activeReimbursementEdition) {
    assertSupportedReimbursementPolicyEdition(input.activeReimbursementEdition);
    activeReimbursementEdition = input.activeReimbursementEdition;
  }

  if (input.revenueWorkflowMode) {
    assertSupportedRevenueWorkflowMode(input.revenueWorkflowMode);
    revenueWorkflowMode = input.revenueWorkflowMode;
  }

  return getDb().workspace.update({
    where: {
      id: workspace.id,
    },
    data: {
      allowLateClaimSubmissions: input.allowLateClaimSubmissions,
      activeReimbursementEdition,
      revenueWorkflowMode,
    },
    select: {
      id: true,
    },
  });
}

export async function updateContributionOperatingModel(input: {
  requesterRole: Role;
  workspaceId: string;
  revenueWorkflowMode: string;
}) {
  if (!canManageClaimPolicy(input.requesterRole)) {
    throw new Error("You do not have permission to manage the contribution operating model.");
  }

  assertSupportedRevenueWorkflowMode(input.revenueWorkflowMode);

  const workspace = await getDb().workspace.findFirst({
    where: {
      id: input.workspaceId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace was not found.");
  }

  return getDb().workspace.update({
    where: {
      id: workspace.id,
    },
    data: {
      revenueWorkflowMode: input.revenueWorkflowMode,
    },
    select: {
      id: true,
    },
  });
}
