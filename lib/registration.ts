import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";

export type SubmitRegistrationApplicationInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
};

export async function submitRegistrationApplication(input: SubmitRegistrationApplicationInput) {
  if (!can(input.requesterRole, "registry:submit")) {
    throw new Error("You do not have permission to submit company registration.");
  }

  const db = getDb();
  const company = await db.company.findFirst({
    where: {
      id: input.companyId,
      recordTier: "HOT",
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
      areaOfficeId: true,
      status: true,
      registrationApplication: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company was not found.");
  }

  if (!company.areaOfficeId) {
    throw new Error("Select an Area Office before submitting registration.");
  }

  const areaOfficeId = company.areaOfficeId;

  if (
    company.registrationApplication &&
    company.registrationApplication.status !== "DRAFT" &&
    company.registrationApplication.status !== "CHANGES_REQUESTED"
  ) {
    throw new Error("This company registration has already been submitted.");
  }

  const requester = await db.user.findUnique({
    where: {
      email: input.requesterEmail,
    },
    select: {
      id: true,
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
    requester.memberships.some((membership) => membership.organizationId === company.organizationId);

  if (!hasOrganizationAccess) {
    throw new Error("You do not have access to this company's registration.");
  }

  return db.$transaction(async (tx) => {
    const registrationApplication = company.registrationApplication
      ? await tx.registrationApplication.update({
          where: {
            id: company.registrationApplication.id,
          },
          data: {
            areaOfficeId,
            submittedById: requester.id,
            status: "SUBMITTED",
            currentDesk: "AREA_MANAGER",
            submittedAt: new Date(),
          },
          select: {
            id: true,
          },
        })
      : await tx.registrationApplication.create({
          data: {
            companyId: company.id,
            areaOfficeId,
            submittedById: requester.id,
            status: "SUBMITTED",
            currentDesk: "AREA_MANAGER",
            submittedAt: new Date(),
          },
          select: {
            id: true,
          },
        });

    await tx.company.update({
      where: {
        id: company.id,
      },
      data: {
        status: "PENDING_REVIEW",
      },
      select: {
        id: true,
      },
    });

    return registrationApplication;
  });
}
