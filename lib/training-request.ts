import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type CreateTrainingRequestFromLineItemInput = {
  lineItemId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export async function createTrainingRequestFromLineItem(
  input: CreateTrainingRequestFromLineItemInput,
) {
  if (!can(input.requesterRole, "training:submit")) {
    throw new Error("You do not have permission to create Training Approval Requests.");
  }

  const db = getDb();
  const lineItem = await db.trainingPlanLineItem.findUnique({
    where: {
      id: input.lineItemId,
    },
    select: {
      id: true,
      trainingTitle: true,
      estimatedCost: true,
      plannedDate: true,
      location: true,
      trainer: true,
      trainingPlanSubmission: {
        select: {
          status: true,
          companyId: true,
          company: {
            select: {
              organizationId: true,
              isActive: true,
              recordTier: true,
            },
          },
        },
      },
    },
  });

  if (!lineItem || lineItem.trainingPlanSubmission.status !== "APPROVED") {
    throw new Error("Training Approval Requests can only be created from approved Training Plan rows.");
  }

  if (
    !lineItem.trainingPlanSubmission.company.isActive ||
    lineItem.trainingPlanSubmission.company.recordTier !== "HOT"
  ) {
    throw new Error("Company is not active.");
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
      (membership) =>
        membership.organizationId === lineItem.trainingPlanSubmission.company.organizationId,
    );

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to create this Training Approval Request.");
  }

  const startsAt = lineItem.plannedDate ?? new Date();

  return db.trainingRequest.create({
    data: {
      companyId: lineItem.trainingPlanSubmission.companyId,
      trainingPlanLineItemId: lineItem.id,
      title: lineItem.trainingTitle,
      provider: lineItem.trainer,
      venue: lineItem.location,
      startsAt,
      endsAt: startsAt,
      estimatedCost: lineItem.estimatedCost,
      status: "DRAFT",
      currentDesk: "COMPANY",
    },
    select: {
      id: true,
      companyId: true,
    },
  });
}
