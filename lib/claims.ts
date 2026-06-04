import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type CreateClaimFromTrainingRequestInput = {
  trainingRequestId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export type UpdateClaimFormInput = {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  claimYear?: number;
  trainingContributionDue?: number;
  trainingContributionPaid?: number;
  itfReceiptNumber?: string;
  bankName?: string;
  accountNumber?: string;
  sortCode?: string;
  claimedAmount: number;
  employerOfficerName?: string;
  employerOfficerRank?: string;
  chiefExecutiveName?: string;
};

export async function createClaimFromTrainingRequest(
  input: CreateClaimFromTrainingRequestInput,
) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to create reimbursement claims.");
  }

  const db = getDb();
  const request = await db.trainingRequest.findFirst({
    where: {
      id: input.trainingRequestId,
      status: "APPROVED",
      recordTier: "HOT",
      monitoringRecords: {
        some: {
          status: "APPROVED",
          recordTier: "HOT",
        },
      },
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      startsAt: true,
      estimatedCost: true,
      company: {
        select: {
          organizationId: true,
          itfEmployerNumber: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Claims can only be created from approved and monitored Training Approval Requests.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === request.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to create a claim for this training.");
  }

  const existingClaim = await db.reimbursementClaim.findFirst({
    where: {
      trainingRequestId: request.id,
      recordTier: "HOT",
    },
    select: {
      id: true,
    },
  });

  if (existingClaim) {
    return existingClaim;
  }

  return db.reimbursementClaim.create({
    data: {
      companyId: request.companyId,
      trainingRequestId: request.id,
      reference: buildClaimReference(request.startsAt),
      claimYear: request.startsAt.getFullYear(),
      itfReceiptNumber: request.company.itfEmployerNumber,
      claimedAmount: request.estimatedCost,
      status: "DRAFT",
    },
    select: {
      id: true,
    },
  });
}

function buildClaimReference(date: Date) {
  return `TR-${date.getFullYear()}-${Date.now()}`;
}

export async function updateClaimForm(input: UpdateClaimFormInput) {
  if (!can(input.requesterRole, "claims:submit")) {
    throw new Error("You do not have permission to update reimbursement claims.");
  }

  if (!Number.isFinite(input.claimedAmount) || input.claimedAmount <= 0) {
    throw new Error("Claimed amount must be greater than zero.");
  }

  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: {
      id: input.claimId,
      status: "DRAFT",
      recordTier: "HOT",
      company: {
        recordTier: "HOT",
        isActive: true,
      },
    },
    select: {
      id: true,
      company: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Editable reimbursement claim was not found.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      memberships: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!requester) {
    throw new Error("User account was not found.");
  }

  const hasOrganizationAccess =
    isItfRole(input.requesterRole) ||
    requester.memberships.some(
      (membership) => membership.organizationId === claim.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to update this claim.");
  }

  return db.reimbursementClaim.update({
    where: {
      id: claim.id,
    },
    data: {
      claimYear: input.claimYear,
      trainingContributionDue: input.trainingContributionDue,
      trainingContributionPaid: input.trainingContributionPaid,
      itfReceiptNumber: input.itfReceiptNumber,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      sortCode: input.sortCode,
      claimedAmount: input.claimedAmount,
      employerOfficerName: input.employerOfficerName,
      employerOfficerRank: input.employerOfficerRank,
      chiefExecutiveName: input.chiefExecutiveName,
      employerDeclaredAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}
