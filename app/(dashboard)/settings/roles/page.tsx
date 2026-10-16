import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatPermission, listRoleManagementGroups } from "@/lib/role-management";

function formatRole(value: string) {
  return value.replaceAll("_", " ");
}

export default async function RoleSettingsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const canManageWorkspace = can(role, "workspace:manage");

  if (!canManageWorkspace) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Roles</h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage roles.
          </p>
        </section>
      </div>
    );
  }

  const roleGroups = listRoleManagementGroups({ requesterRole: role });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Roles</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Review the system-managed roles currently available for reimbursement workflows.
            Configurable role creation will come after workflow boundaries and permissions stabilize.
            These roles grant application permissions; they are not staff job titles. Job titles and departments are managed separately under Departments and job titles.
          </p>
        </div>

        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Roles are still backed by the Prisma `Role` enum and application permission checks. This
          page is the management foundation, not yet a custom role builder.
        </div>

        <div className="mt-6 grid gap-5">
          {roleGroups.map((group) => (
            <section key={group.scope} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{group.roles.length} roles</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
                  System-managed
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {group.roles.map((definition) => (
                  <article
                    key={definition.role}
                    className="rounded-md border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-zinc-950">{definition.title}</h3>
                        <p className="mt-1 font-mono text-xs text-zinc-500">
                          {formatRole(definition.role)}
                        </p>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                        Locked
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{definition.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {definition.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full bg-[#800020]/10 px-2 py-1 text-xs font-semibold text-[#65001a]"
                        >
                          {formatPermission(permission)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
