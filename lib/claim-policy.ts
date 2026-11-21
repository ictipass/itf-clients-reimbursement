import { getDb } from "@/lib/db";
import { canManageClaimPolicy, type Role } from "@/lib/rbac";
import {
  validatePolicyActivation,
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
  eligibilityEndpointUrl: string | null;
};

export function getClaimSubmissionDeadline(trainingYear: number) {
  return new Date(Date.UTC(trainingYear + 1, 5, 30, 23, 59, 59, 999));
}

export function isLateClaimSubmission(trainingYear: number, now = new Date()) {
  return now.getTime() > getClaimSubmissionDeadline(trainingYear).getTime();
}

export function getClaimYearFilingError(trainingYear: number, filingYear: number) {
  if (trainingYear === filingYear - 1) return null;
  if (trainingYear >= filingYear) {
    return `Training held in ${trainingYear} can first be claimed in ${trainingYear + 1}.`;
  }
  return `Only training held in ${filingYear - 1} can be claimed in ${filingYear}. The late-submission setting does not reopen earlier training years.`;
}

export async function listClaimPolicyWorkspaces(input: { requesterRole: Role; requesterEmail: string }) {
  if (!canManageClaimPolicy(input.requesterRole)) {
    throw new Error("You do not have permission to manage claim submission settings.");
  }

  return getDb().workspace.findMany({
    where: {
      isActive: true,
      memberships: {
        some: {
          isActive: true,
          role: input.requesterRole,
          user: { email: input.requesterEmail.toLowerCase().trim(), isActive: true },
        },
      },
    },
    select: {
      id: true,
      name: true,
      allowLateClaimSubmissions: true,
      activeReimbursementEdition: true,
      reimbursementPolicyActivations: {
        orderBy: { activatedAt: "desc" },
        take: 1,
        select: {
          edition: true,
          approvalReference: true,
          activatedAt: true,
          activatedBy: { select: { name: true } },
        },
      },
      revenueWorkflowMode: true,
      eligibilityEndpointUrl: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function updateClaimSubmissionPolicy(input: {
  requesterRole: Role;
  requesterEmail: string;
  workspaceId: string;
  allowLateClaimSubmissions: boolean;
  revenueWorkflowMode?: string;
}) {
  if (!canManageClaimPolicy(input.requesterRole)) {
    throw new Error("You do not have permission to manage claim submission settings.");
  }

  const workspace = await getDb().workspace.findFirst({
    where: {
      id: input.workspaceId,
      isActive: true,
      memberships: {
        some: {
          isActive: true,
          role: input.requesterRole,
          user: { email: input.requesterEmail.toLowerCase().trim(), isActive: true },
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace was not found.");
  }

  let revenueWorkflowMode: RevenueWorkflowMode | undefined;

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
      revenueWorkflowMode,
    },
    select: {
      id: true,
    },
  });
}

export async function activateReimbursementPolicy(input: {
  requesterEmail: string;
  requesterRole: Role;
  workspaceId: string;
  edition: string;
  approvalReference: string;
  approvalConfirmed: boolean;
}) {
  if (input.requesterRole !== "SYSTEM_ADMIN" && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
    throw new Error("Only an administrator can activate reimbursement policy.");
  }

  return getDb().$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: { id: input.workspaceId, isActive: true },
      select: {
        id: true,
        activeReimbursementEdition: true,
        reimbursementPolicyActivations: {
          orderBy: { activatedAt: "desc" },
          take: 1,
          select: { edition: true },
        },
      },
    });
    if (!workspace) throw new Error("Workspace was not found.");

    const actor = await tx.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase().trim() },
      select: {
        id: true,
        isActive: true,
        memberships: {
          where: {
            workspaceId: input.workspaceId,
            isActive: true,
            role: input.requesterRole,
          },
          select: { id: true },
        },
      },
    });
    if (!actor?.isActive || actor.memberships.length === 0) {
      throw new Error("An active administrator assignment in this workspace is required.");
    }

    const approved = validatePolicyActivation({
      requesterRole: input.requesterRole,
      edition: input.edition,
      currentEdition: workspace.activeReimbursementEdition,
      lastActivatedEdition: workspace.reimbursementPolicyActivations[0]?.edition ?? null,
      approvalReference: input.approvalReference,
      approvalConfirmed: input.approvalConfirmed,
    });

    if (approved.edition !== workspace.activeReimbursementEdition) {
      await tx.workspace.update({
        where: { id: workspace.id },
        data: { activeReimbursementEdition: approved.edition },
      });
    }

    const activation = await tx.reimbursementPolicyActivation.create({
      data: {
        workspaceId: workspace.id,
        previousEdition: workspace.activeReimbursementEdition,
        edition: approved.edition,
        implementationKey: approved.implementationKey,
        approvalReference: approved.approvalReference,
        activatedById: actor.id,
      },
      select: { id: true },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        actorId: actor.id,
        action: "UPDATE",
        entityType: "REIMBURSEMENT_POLICY",
        entityId: activation.id,
        reason: approved.approvalReference,
        metadata: {
          previousEdition: workspace.activeReimbursementEdition,
          edition: approved.edition,
          implementationKey: approved.implementationKey,
        },
      },
    });

    return activation;
  }, { isolationLevel: "Serializable", timeout: 10_000 });
}

export async function updateContributionOperatingModel(input: {
  requesterRole: Role;
  requesterEmail: string;
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
      memberships: {
        some: {
          isActive: true,
          role: input.requesterRole,
          user: { email: input.requesterEmail.toLowerCase().trim(), isActive: true },
        },
      },
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
