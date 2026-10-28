import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { recoverAssignmentAction } from "@/app/(dashboard)/settings/assignment-recovery/actions";
import { FormActionProgress } from "@/components/form-action-progress";
import { authOptions } from "@/lib/auth";
import { getRecoveryAdmin, listRecoveryOfficers, listStrandedAssignments, recoveryTarget } from "@/lib/assignment-recovery";

export default async function AssignmentRecoveryPage({ searchParams }: Readonly<{
  searchParams: Promise<{ page?: string; message?: string }>;
}>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) notFound();
  const admin = await getRecoveryAdmin(session.user.email, session.user.role);
  if (!admin) notFound();
  const query = await searchParams;
  const result = await listStrandedAssignments(admin.memberships.map((membership) => membership.workspaceId), Number(query.page ?? "1"));
  const officers = await listRecoveryOfficers(result.items);
  const pages = Math.max(Math.ceil(result.total / result.pageSize), 1);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Administration</p>
          <h1 className="mt-2 text-3xl font-semibold">Stranded assignments</h1>
        </div>
        <Link href="/settings/users" className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold">Manage officers</Link>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
        Open jobs assigned to an inactive officer or someone without the required active role and office membership. Reassigning keeps the job at its current desk and records the reason in its decision trail.
      </p>
      {query.message ? <p role="status" className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">{query.message}</p> : null}
      <p className="mt-5 text-sm font-semibold">{result.total} stranded assignment{result.total === 1 ? "" : "s"} · Page {result.page} of {pages}</p>
      <div className="mt-4 grid gap-4">
        {result.items.length === 0 ? <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm">No stranded named assignments were found.</p> : result.items.map((item) => {
          const target = recoveryTarget(item);
          const choices = officers.get(item.id) ?? [];
          return <section key={item.id} className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm text-zinc-600">{item.company?.legalName ?? "No company"} · {item.areaOffice?.name ?? "Headquarters"} · {item.assignedRole?.replaceAll("_", " ") ?? "No role"}</p>
                <p className="mt-1 text-sm text-zinc-600">Assigned to {item.assignedUser?.name ?? "Unknown officer"} ({item.assignedUser?.email ?? "no email"}){item.assignedUser?.isActive ? "" : " · inactive"}</p>
              </div>
              {item.targetHref.startsWith("/") && !item.targetHref.startsWith("//") ? <Link href={item.targetHref} className="text-sm font-semibold text-[#800020] underline">Open job</Link> : null}
            </div>
            {!target ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">This open item has no supported reassignment action. Review the linked job and its current desk before changing access.</p>
              : choices.length === 0 ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">No active replacement holds this role in the required office or workspace. Assign one under Offices, then refresh this page.</p>
              : <form action={recoverAssignmentAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <input type="hidden" name="workItemId" value={item.id} />
                <label className="grid gap-1 text-sm font-medium">Replacement officer
                  <select name="assigneeUserId" required defaultValue="" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3">
                    <option value="" disabled>Select an officer</option>
                    {choices.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} ({officer.email})</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">Reason for reassignment
                  <input name="reason" required maxLength={500} className="min-h-10 rounded-md border border-zinc-200 px-3" />
                </label>
                <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Reassign</button>
                <FormActionProgress />
              </form>}
          </section>;
        })}
      </div>
      <nav aria-label="Recovery pages" className="mt-6 flex gap-3 text-sm font-semibold">
        {result.page > 1 ? <Link href={`/settings/assignment-recovery?page=${result.page - 1}`} className="rounded-md border px-4 py-2">Previous</Link> : null}
        {result.page < pages ? <Link href={`/settings/assignment-recovery?page=${result.page + 1}`} className="rounded-md border px-4 py-2">Next</Link> : null}
      </nav>
    </main>
  );
}
