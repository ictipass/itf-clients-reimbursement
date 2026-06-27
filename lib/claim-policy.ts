import { getDb } from "@/lib/db";
import { canManageClaimPolicy, type Role } from "@/lib/rbac";

export const CLAIM_SUBMISSION_DEADLINE_NOTICE =
  "ALL TRAINING CLAIMS MUST BE SUBMITTED ON OR BEFORE 30TH JUNE AFTER EACH TRAINING YEAR (JANUARY - DECEMBER)";

export type ClaimPolicyWorkspace = {
  id: string;
  name: string;
  allowLateClaimSubmissions: boolean;
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

  return getDb().workspace.update({
    where: {
      id: workspace.id,
    },
    data: {
      allowLateClaimSubmissions: input.allowLateClaimSubmissions,
    },
    select: {
      id: true,
    },
  });
}
