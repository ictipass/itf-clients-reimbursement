import { cookies } from "next/headers";

import { getDb } from "@/lib/db";

export const activeOrganizationCookie = "itf-active-organization";

export async function listAvailableEmployerOrganizations(email: string) {
  const memberships = await getDb().membership.findMany({
    where: {
      user: { email: email.toLowerCase(), isActive: true },
      isActive: true,
      organizationId: { not: null },
      role: { in: ["EMPLOYER_ADMIN", "EMPLOYER_SUBMITTER", "EMPLOYER_VIEWER"] },
      organization: { organizationType: "EMPLOYER", isActive: true },
    },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { name: true } },
    },
    orderBy: { organization: { name: "asc" } },
  });

  return memberships
    .filter((membership) => membership.organizationId && membership.organization)
    .map((membership) => ({
      id: membership.organizationId as string,
      name: membership.organization?.name ?? "Employer organization",
      role: membership.role,
    }));
}

export async function getActiveEmployerOrganization(email: string) {
  const organizations = await listAvailableEmployerOrganizations(email);
  const selectedId = (await cookies()).get(activeOrganizationCookie)?.value;
  const selected = organizations.find((organization) => organization.id === selectedId);

  return {
    active: selected ?? (organizations.length === 1 ? organizations[0] : null),
    organizations,
    requiresSelection: organizations.length > 1 && !selected,
  };
}
