import { cookies } from "next/headers";

import { getDb } from "@/lib/db";
import type { Role } from "@/lib/rbac";

export const activeOrganizationCookie = "itf-active-organization";

export class ActiveEmployerOrganizationRequiredError extends Error {
  constructor(message = "Select an active employer organization before continuing.") {
    super(message);
    this.name = "ActiveEmployerOrganizationRequiredError";
  }
}

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
  return resolveActiveEmployerOrganization(organizations, selectedId);
}

export function resolveActiveEmployerOrganization(
  organizations: Array<{ id: string; name: string; role: Role }>,
  selectedId?: string,
) {
  const selected = organizations.find((organization) => organization.id === selectedId);
  return {
    active: selected ?? (organizations.length === 1 ? organizations[0] : null),
    organizations,
    requiresSelection: organizations.length > 1 && !selected,
  };
}

export async function requireActiveEmployerOrganization(email: string) {
  const context = await getActiveEmployerOrganization(email);
  if (!context.active) throw new ActiveEmployerOrganizationRequiredError();
  return context.active;
}
