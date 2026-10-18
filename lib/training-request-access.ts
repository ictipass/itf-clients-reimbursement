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

  const desk = deskByRole[input.role];
  return desk
    ? { ...base, submittedAt: { not: null }, currentDesk: desk as "AREA_MANAGER" | "HEAD_OF_TRAINING" | "REIMBURSEMENT_OFFICER" }
    : { ...base, companyId: "__no_access__" };
}
