import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type CreateClaimFromTrainingRequestInput = {
  trainingRequestId: string;
  requesterEmail: string;
  requesterRole: Role;
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
