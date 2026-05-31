import { getServerSession } from "next-auth";

import {
  assignAreaOfficeOfficerAction,
  removeAreaOfficeOfficerAction,
  updateAreaOfficeStatusAction,
} from "@/app/(dashboard)/settings/area-offices/actions";
import {
  getAreaOfficeOfficerRoles,
  listAreaOfficeOfficerManagementData,
} from "@/lib/area-office-management";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";

function formatRole(value: string) {
  return value.replaceAll("_", " ");
}

function getMessage(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AreaOfficeSettingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ message?: string | string[] }>;
}>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const canManageWorkspace = can(role, "workspace:manage");
  const query = await searchParams;
  const message = getMessage(query.message);

  if (!canManageWorkspace) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Area Offices</h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage Area Office officers.
          </p>
        </section>
      </div>
    );
  }

  const { areaOffices, users } = await listAreaOfficeOfficerManagementData({
    requesterRole: role,
  });
  const officerRoles = getAreaOfficeOfficerRoles();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Area Offices</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Manage Area Office availability and officer assignments for registration, training, and
            reimbursement workflows.
          </p>
        </div>

        {message ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4">
          {areaOffices.map((areaOffice) => (
            <article
              key={areaOffice.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{areaOffice.name}</h2>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        areaOffice.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {areaOffice.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {areaOffice.workspace.name} · {areaOffice.slug}
                    {areaOffice.code ? ` · ${areaOffice.code}` : ""}
                  </p>
                </div>
                <form action={updateAreaOfficeStatusAction}>
                  <input type="hidden" name="areaOfficeId" value={areaOffice.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={areaOffice.isActive ? "false" : "true"}
                  />
                  <button className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800">
                    {areaOffice.isActive ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-md border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Assigned officers
                    </p>
                  </div>
                  {areaOffice.memberships.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zinc-600">
                      No officers have been assigned to this Area Office yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {areaOffice.memberships.map((membership) => (
                        <div
                          key={membership.id}
                          className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-zinc-950">
                              {membership.user.name}
                              {!membership.user.isActive ? (
                                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                                  inactive
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {membership.user.email} · {formatRole(membership.role)}
                            </p>
                          </div>
                          <form action={removeAreaOfficeOfficerAction}>
                            <input type="hidden" name="membershipId" value={membership.id} />
                            <button className="min-h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800">
                              Remove
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form
                  action={assignAreaOfficeOfficerAction}
                  className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3"
                >
                  <input type="hidden" name="areaOfficeId" value={areaOffice.id} />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Assign officer
                  </p>
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">
                    Officer
                    <select
                      name="userId"
                      required
                      className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                    >
                      <option value="">Select user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">
                    Role
                    <select
                      name="role"
                      required
                      className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                    >
                      <option value="">Select role</option>
                      {officerRoles.map((officerRole) => (
                        <option key={officerRole} value={officerRole}>
                          {formatRole(officerRole)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="min-h-10 rounded-md bg-[#800020] px-3 text-sm font-semibold text-white">
                    Save assignment
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
