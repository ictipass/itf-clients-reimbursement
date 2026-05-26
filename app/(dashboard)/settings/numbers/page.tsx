import { getServerSession } from "next-auth";
import Link from "next/link";

import { createManagedNumbersAction } from "@/app/(dashboard)/settings/numbers/actions";
import { authOptions } from "@/lib/auth";
import {
  getManagedNumberTypes,
  listManagedNumbers,
  listManagedNumberWorkspaces,
} from "@/lib/managed-numbers";
import { can } from "@/lib/rbac";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ManagedNumbersPage() {
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Registration numbers
          </h1>
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage registration numbers.
          </p>
        </section>
      </div>
    );
  }

  const [managedNumbers, workspaces] = await Promise.all([
    listManagedNumbers({ requesterRole: role }),
    listManagedNumberWorkspaces(),
  ]);

  const totals = managedNumbers.reduce(
    (summary, managedNumber) => {
      summary[managedNumber.status] += 1;
      return summary;
    },
    {
      AVAILABLE: 0,
      RESERVED: 0,
      ASSIGNED: 0,
      VOIDED: 0,
    },
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Registration numbers
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Manage ITF employer numbers and certificate numbers before they are assigned to
              completed registrations.
            </p>
          </div>
          <Link
            href="/settings/certificates"
            className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
          >
            Certificate templates
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {Object.entries(totals).map(([status, count]) => (
            <div key={status} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {status}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{count}</p>
            </div>
          ))}
        </div>

        <form
          action={createManagedNumbersAction}
          className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Create or import numbers</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Enter one number per line, or paste comma-separated values from an approved register.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Workspace
              <select
                name="workspaceId"
                required
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Number type
              <select
                name="type"
                required
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              >
                {getManagedNumberTypes().map((type) => (
                  <option key={type} value={type}>
                    {formatType(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Policy code
              <input
                name="policyCode"
                placeholder="2026-FSD"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Batch code
              <input
                name="batchCode"
                placeholder="BATCH-001"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Numbers
            <textarea
              name="values"
              required
              rows={5}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Notes
              <input
                name="notes"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Save numbers
            </button>
          </div>
        </form>

        {managedNumbers.length === 0 ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No managed registration numbers have been created yet.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned to</th>
                  <th className="px-4 py-3">Issued by</th>
                  <th className="px-4 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {managedNumbers.map((managedNumber) => (
                  <tr key={managedNumber.id}>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-zinc-950">{managedNumber.value}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatType(managedNumber.type)} · {managedNumber.workspace.name}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                        {managedNumber.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {managedNumber.assignedCompany ? (
                        <Link
                          href={`/registry/${managedNumber.assignedCompany.id}`}
                          className="font-semibold text-[#800020]"
                        >
                          {managedNumber.assignedCompany.legalName}
                        </Link>
                      ) : (
                        "Not assigned"
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      <p>{managedNumber.issuedBy?.name ?? "Not issued"}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDate(managedNumber.issuedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-zinc-700">
                      <p>Policy: {managedNumber.policyCode ?? "None"}</p>
                      <p>Batch: {managedNumber.batchCode ?? "None"}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Created by {managedNumber.createdBy?.name ?? "Unknown"} on{" "}
                        {formatDate(managedNumber.createdAt)}
                      </p>
                      {managedNumber.notes ? (
                        <p className="mt-1 text-xs text-zinc-500">{managedNumber.notes}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
