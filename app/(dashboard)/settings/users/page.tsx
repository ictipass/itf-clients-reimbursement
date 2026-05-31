import { getServerSession } from "next-auth";
import Link from "next/link";

import { createDirectoryUserAction } from "@/app/(dashboard)/settings/users/actions";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listDirectoryUsers } from "@/lib/user-directory";

function formatRole(value: string) {
  return value.replaceAll("_", " ");
}

function getMessage(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UserDirectoryPage({
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage users.
          </p>
        </section>
      </div>
    );
  }

  const users = await listDirectoryUsers({ requesterRole: role });

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
              Create real staff users and import user records before assigning them to Area Office
              or Headquarters workflow roles.
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
                User can be assigned to an Area Office or HQ role after creation.
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

        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Staff details</th>
                <th className="px-4 py-3">Assignments</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {users.map((user) => (
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
                      "No assignments"
                    ) : (
                      <div className="grid gap-1">
                        {user.memberships.map((membership) => (
                          <p key={membership.id}>
                            <span className="font-semibold">{formatRole(membership.role)}</span>
                            {" · "}
                            {membership.areaOffice?.name ?? membership.organization?.name ?? "Workspace"}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
