import type { Prisma } from "@/lib/generated/prisma/client";
import { getDb } from "@/lib/db";
import { type Role } from "@/lib/rbac";

const deskByRole: Partial<Record<Role, string>> = {
  AREA_MANAGER: "AREA_MANAGER",
  HEAD_OF_TRAINING: "HEAD_OF_TRAINING",
  REIMBURSEMENT_OFFICER: "REIMBURSEMENT_OFFICER",
};

export async function getVisibleTrainingRequestWhere(input: {
  email?: string | null;
  role: Role;
}): Promise<Prisma.TrainingRequestWhereInput> {
  const base: Prisma.TrainingRequestWhereInput = { recordTier: "HOT" };

  if (!input.email) {
    return { ...base, companyId: "__no_access__" };
  }

  if (input.role === "SYSTEM_ADMIN" || input.role === "WORKSPACE_APP_ADMIN") {
    return { ...base, submittedAt: { not: null } };
  }

  if (input.role === "EMPLOYER_ADMIN" || input.role === "EMPLOYER_SUBMITTER") {
    const memberships = await getDb().membership.findMany({
      where: { user: { email: input.email, isActive: true }, isActive: true },
      select: { organizationId: true },
    });
    const organizationIds = memberships
      .map((membership) => membership.organizationId)
      .filter((id): id is string => Boolean(id));

    return organizationIds.length > 0
      ? { ...base, company: { organizationId: { in: organizationIds } } }
      : { ...base, companyId: "__no_access__" };
  }

  if (input.role === "HEAD_OF_TRAINING") {
    const sender = await getDb().user.findFirst({
      where: { email: input.email, isActive: true },
      select: {
        id: true,
        memberships: {
          where: { isActive: true, role: "HEAD_OF_TRAINING", areaOfficeId: { not: null } },
          select: { areaOfficeId: true },
        },
      },
    });
    const areaOfficeIds = sender?.memberships
      .map((membership) => membership.areaOfficeId)
      .filter((id): id is string => Boolean(id)) ?? [];
    if (!sender || areaOfficeIds.length === 0) return { ...base, companyId: "__no_access__" };

    return {
      ...base,
      submittedAt: { not: null },
      company: { areaOfficeId: { in: areaOfficeIds } },
      OR: [
        { currentDesk: "HEAD_OF_TRAINING" },
        {
          currentDesk: "REIMBURSEMENT_OFFICER",
          status: "IN_REVIEW",
          decisions: { some: {
            actorId: sender.id,
            recordTier: "HOT",
            reason: { startsWith: "HOT forwarded Training Approval Request to Reimbursement Officer" },
          } },
        },
      ],
    };
  }

  const desk = deskByRole[input.role];
  if (!desk) return { ...base, companyId: "__no_access__" };
  const memberships = await getDb().membership.findMany({
    where: { user: { email: input.email, isActive: true }, isActive: true, role: input.role, areaOfficeId: { not: null } },
    select: { areaOfficeId: true },
  });
  const areaOfficeIds = memberships.map((membership) => membership.areaOfficeId).filter((id): id is string => Boolean(id));
  return areaOfficeIds.length
    ? { ...base, submittedAt: { not: null }, currentDesk: desk as "AREA_MANAGER" | "REIMBURSEMENT_OFFICER", company: { areaOfficeId: { in: areaOfficeIds } } }
    : { ...base, companyId: "__no_access__" };
}
