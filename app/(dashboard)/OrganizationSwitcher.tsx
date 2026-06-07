import { selectActiveOrganizationAction } from "@/app/(dashboard)/organization-context-actions";

export function OrganizationSwitcher({
  activeOrganizationId,
  organizations,
}: Readonly<{
  activeOrganizationId?: string;
  organizations: Array<{ id: string; name: string; role: string }>;
}>) {
  if (organizations.length < 2) return null;

  return (
    <form action={selectActiveOrganizationAction} className="grid gap-2 border-t border-zinc-200 pt-3">
      <label className="grid gap-1 text-xs font-semibold text-zinc-700">
        Active organization
        <select
          name="organizationId"
          defaultValue={activeOrganizationId ?? ""}
          required
          className="min-h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs"
        >
          <option value="" disabled>Select organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <button className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold">
        Switch organization
      </button>
    </form>
  );
}
