import { getServerSession } from "next-auth";
import Link from "next/link";

import { createDirectoryUserAction, resetDirectoryUserLocalAccessAction, updateDirectoryUserStatusAction } from "@/app/(dashboard)/settings/users/actions";
import { UserEditDialog } from "@/app/(dashboard)/settings/users/user-edit-dialog";
import { authOptions } from "@/lib/auth";
import { can, roles } from "@/lib/rbac";
import { listDirectoryUsers } from "@/lib/user-directory";

function formatRole(value: string) {
  return value.replaceAll("_", " ");
}

function getMessage(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UserDirectoryPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    message?: string | string[];
    q?: string | string[];
    role?: string | string[];
    status?: string | string[];
    page?: string | string[];
  }>;
}>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "SYSTEM_ADMIN";
  const canManageWorkspace = can(role, "workspace:manage");
  const query = await searchParams;
  const message = getMessage(query.message);
  const search = getValue(query.q) ?? "";
  const selectedRole = getValue(query.role) ?? "";
  const status = getValue(query.status) ?? "";
  const requestedPage = Number(getValue(query.page) ?? "1");

  if (!canManageWorkspace) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage users.
          </p>
        </section>
      </div>
    );
  }

  const users = await listDirectoryUsers({
    requesterRole: role,
    query: search,
    role: selectedRole,
    status,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (selectedRole) params.set("role", selectedRole);
    if (status) params.set("status", status);
    params.set("page", String(page));
    return `/settings/users?${params}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Users</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Manage staff directory records. Office assignments are attached or removed from the
              Offices page; removing an assignment does not delete the staff user.
            </p>
          </div>
          <Link
            href="/settings/users/template"
            className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
          >
            Download CSV template
          </Link>
        </div>

        {message ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form
            action={createDirectoryUserAction}
            className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Create user</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                User can be assigned to an Area Office or Headquarters role after creation.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Full name
                <input
                  name="name"
                  required
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Staff number
                <input
                  name="staffNumber"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Phone number
                <input
                  name="phoneNumber"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Department
                <input
                  name="department"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Job title
                <input
                  name="jobTitle"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
            </div>
            <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Save user
            </button>
          </form>

          <form
            action="/settings/users/import"
            method="post"
            encType="multipart/form-data"
            className="grid content-start gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Bulk import</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Upload CSV with full name, staff number, email address, phone number, department,
                and job title.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              User CSV
              <input
                name="file"
                type="file"
                required
                accept=".csv,text/csv"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              />
            </label>
            <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Import users
            </button>
          </form>
        </div>

        <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[1fr_0.8fr_0.6fr_auto_auto]">
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name, email, staff number, or department"
            className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
          />
          <select name="role" defaultValue={selectedRole} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm">
            <option value="">All roles</option>
            {roles.map((candidate) => <option key={candidate} value={candidate}>{formatRole(candidate)}</option>)}
          </select>
          <select name="status" defaultValue={status} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            <option value="active">Active users</option>
            <option value="inactive">Inactive users</option>
          </select>
          <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Filter</button>
          <Link href="/settings/users" className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold">Clear</Link>
        </form>

        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Staff details</th>
                <th className="px-4 py-3">Assignments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provisioning</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {users.items.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-zinc-950">{user.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{user.email}</p>
                    {user.phoneNumber ? (
                      <p className="mt-1 text-xs text-zinc-500">{user.phoneNumber}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top text-zinc-700">
                    <p>Staff no: {user.staffNumber ?? "Not set"}</p>
                    <p>Department: {user.department ?? "Not set"}</p>
                    <p>Job title: {user.jobTitle ?? "Not set"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-zinc-700">
                    {user.memberships.length === 0 ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                        No office assignment
                      </span>
                    ) : (
                      <div className="grid gap-1">
                        {user.memberships.map((membership) => (
                          <p key={membership.id}>
                            <span className="font-semibold">{formatRole(membership.role)}</span>
                            {" · "}
                            {membership.areaOffice?.name ??
                              membership.organization?.name ??
                              "Workspace"}
                            {!membership.isActive ? (
                              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                                inactive assignment
                              </span>
                            ) : null}
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        user.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top text-xs leading-5 text-zinc-600">
                    <p className="font-semibold text-zinc-800">{formatRole(user.authenticationSource)}</p>
                    <p>{user.mustChangePassword ? "Password change required" : "Access ready"}</p>
                    <p>Provisioned: {user.provisionedAt?.toLocaleDateString("en-NG") ?? "Not provisioned"}</p>
                    <p>Welcome email: {user.welcomeEmailSentAt?.toLocaleDateString("en-NG") ?? "Not delivered"}</p>
                    <p>Last sign-in: {user.lastSignedInAt?.toLocaleDateString("en-NG") ?? "Never"}</p>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <UserEditDialog user={user} />
                      <form action={resetDirectoryUserLocalAccessAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold">
                          Reset local access
                        </button>
                      </form>
                      <form action={updateDirectoryUserStatusAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
                        <button className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold">
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {users.items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-600">No users matched these filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-zinc-600">
            Showing {users.items.length} of {users.total} user(s) · page {users.page} of {users.totalPages}
          </p>
          <div className="flex gap-2">
            {users.page > 1 ? <Link href={pageHref(users.page - 1)} className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-semibold">Previous</Link> : null}
            {users.page < users.totalPages ? <Link href={pageHref(users.page + 1)} className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-semibold">Next</Link> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
