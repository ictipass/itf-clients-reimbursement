import { FormActionProgress } from "@/components/form-action-progress";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { replaceEmployerAdministratorsAction } from "@/app/(dashboard)/settings/employers/actions";
import { authOptions } from "@/lib/auth";
import { listEmployerAccessAdministration } from "@/lib/employer-access-management";
import { can } from "@/lib/rbac";

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

export default async function EmployerAccessPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ message?: string; q?: string }> }>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const query = await searchParams;

  if (!can(role, "workspace:manage")) {
    return <p className="mx-auto max-w-7xl px-6 py-8 text-sm">You do not have permission to manage employer access.</p>;
  }

  const organizations = await listEmployerAccessAdministration({
    requesterRole: role,
    query: query.q,
  });

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:px-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Employer access</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Restore an employer organization&apos;s access after receiving formal authorization.
          Replacements preserve former memberships and their historical actions.
        </p>
      </section>

      {query.message ? (
        <p role="status" className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm font-medium">
          {query.message}
        </p>
      ) : null}

      <form className="flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Search organization, company, or member email"
          className="min-h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        />
        <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Search</button>
        {query.q ? <Link href="/settings/employers" className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold">Clear</Link> : null}
        <FormActionProgress />
      </form>

      <div className="grid gap-4">
        {organizations.map((organization) => (
          <details key={organization.id} className="rounded-lg border border-zinc-200 bg-white">
            <summary className="cursor-pointer list-none px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{organization.name}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {organization.companies.length} company record(s) · {organization.memberships.filter((membership) => membership.isActive).length} active member(s)
                  </p>
                </div>
                <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold">
                  {organization.isActive ? "Active organization" : "Inactive organization"}
                </span>
              </div>
            </summary>
            <div className="grid gap-5 border-t border-zinc-200 px-5 py-5 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <h3 className="text-sm font-semibold">Membership history</h3>
                <div className="mt-3 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                  {organization.memberships.map((membership) => (
                    <div key={membership.id} className="px-3 py-3 text-sm">
                      <p className="font-semibold">{membership.user.name}</p>
                      <p className="mt-1 text-zinc-600">{membership.user.email}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatRole(membership.role)} · {membership.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                  ))}
                  {organization.memberships.length === 0 ? <p className="px-3 py-4 text-sm text-zinc-600">No employer memberships.</p> : null}
                </div>
              </div>
              <form action={replaceEmployerAdministratorsAction} className="grid content-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div>
                  <h3 className="font-semibold text-amber-950">Emergency administrator replacement</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    The replacement must already have an active, verified employer portal account.
                    Every currently active employer administrator is deactivated atomically.
                  </p>
                </div>
                <input type="hidden" name="organizationId" value={organization.id} />
                <label className="grid gap-2 text-sm font-medium text-amber-950">
                  Replacement email
                  <input name="replacementEmail" type="email" required className="min-h-11 rounded-md border border-amber-300 bg-white px-3" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-amber-950">
                  Formal authorization reason
                  <textarea name="reason" required minLength={10} rows={3} className="rounded-md border border-amber-300 bg-white px-3 py-2" />
                </label>
                <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Replace employer administrators
                </button>
                <FormActionProgress />
              </form>
            </div>
          </details>
        ))}
        {organizations.length === 0 ? <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">No employer organizations matched your search.</p> : null}
      </div>
    </div>
  );
}
