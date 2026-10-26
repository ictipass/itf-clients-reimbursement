import { FormActionProgress } from "@/components/form-action-progress";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { listAuditEvents } from "@/lib/audit-log";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

export default async function AuditLogPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const params = await searchParams;

  if (!can(role, "audit:read")) {
    return <p className="p-8 text-sm text-zinc-600">You do not have permission to read audit events.</p>;
  }

  const filters = {
    action: value(params.action),
    actor: value(params.actor),
    entityType: value(params.entityType),
    eventType: value(params.eventType),
    page: Number(value(params.page) ?? "1"),
  };
  const result = await listAuditEvents({ requesterRole: role, filters });
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    Object.entries({ ...filters, page }).forEach(([key, entry]) => {
      if (entry) query.set(key, String(entry));
    });
    return `/settings/audit?${query}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-2 text-sm text-zinc-600">Review workflow and security events recorded by the reimbursement app.</p>

        <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-4">
          <input name="actor" defaultValue={filters.actor} placeholder="Actor name or email" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
          <input name="entityType" defaultValue={filters.entityType} placeholder="Entity type" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
          <input name="action" defaultValue={filters.action} placeholder="Action, e.g. REJECT" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
          <input name="eventType" defaultValue={filters.eventType} placeholder="Security event type" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
          <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Filter events</button>
          <FormActionProgress />
        </form>

        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Reason</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {result.events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{event.createdAt.toLocaleString("en-NG")}</td>
                  <td className="px-4 py-3 font-semibold">{event.action}</td>
                  <td className="px-4 py-3">{event.actor?.name ?? "Unknown/system"}<p className="text-xs text-zinc-500">{event.actor?.email}</p></td>
                  <td className="px-4 py-3"><span className="font-semibold">{event.entityType}</span><p className="font-mono text-xs text-zinc-500">{event.entityId}</p></td>
                  <td className="max-w-md px-4 py-3 text-zinc-600">{event.reason ?? "No reason recorded"}{event.organization ? <p className="mt-1 text-xs">{event.organization.name}</p> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-zinc-600">{result.total} events · page {result.page} of {result.pages}</span>
          <div className="flex gap-2">
            {result.page > 1 ? <Link href={pageHref(result.page - 1)} className="rounded-md border px-3 py-2">Previous</Link> : null}
            {result.page < result.pages ? <Link href={pageHref(result.page + 1)} className="rounded-md border px-3 py-2">Next</Link> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
