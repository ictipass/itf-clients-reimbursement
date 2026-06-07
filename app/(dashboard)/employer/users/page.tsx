import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  changeEmployerMemberRoleAction,
  deactivateEmployerMemberAction,
  inviteEmployerMemberAction,
  reactivateEmployerMemberAction,
  revokeEmployerInvitationAction,
} from "@/app/(dashboard)/employer/users/actions";
import { authOptions } from "@/lib/auth";
import {
  EmployerOrganizationRequiredError,
  getEmployerRoles,
  listEmployerMemberManagementData,
} from "@/lib/employer-members";
import { ActiveEmployerOrganizationRequiredError } from "@/lib/organization-context";

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

export default async function EmployerUsersPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ message?: string; token?: string }> }>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.role !== "EMPLOYER_ADMIN") redirect("/dashboard");
  const query = await searchParams;
  let data: Awaited<ReturnType<typeof listEmployerMemberManagementData>> | null = null;

  try {
    data = await listEmployerMemberManagementData(session.user.email);
  } catch (error) {
    if (error instanceof ActiveEmployerOrganizationRequiredError) {
      return (
        <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
          <section role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h1 className="text-xl font-semibold">Select an organization first</h1>
            <p className="mt-3 text-sm leading-6">
              Use the Active organization selector in your account menu, then reopen Organization users.
            </p>
            <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Go to dashboard
            </Link>
          </section>
        </div>
      );
    }
    if (!(error instanceof EmployerOrganizationRequiredError)) throw error;
  }

  if (!data) {
    return (
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 lg:px-8">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Organization administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Organization users</h1>
        </section>

        <section
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
            Company setup required
          </p>
          <h2 className="mt-2 text-xl font-semibold">Create your first company first</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6">
            Organization user management becomes available after your first company is created.
            Creating the company also establishes your employer organization and links your
            administrator account to it.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/registry/new"
              className="inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
            >
              Create first company
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950"
            >
              Return to dashboard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:px-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Organization administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.organizationName} users</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Invite colleagues and control their reimbursement-platform access. Removing access
          preserves the person&apos;s identity and historical actions.
        </p>
      </section>

      {query.message ? (
        <p className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800">
          {query.message}
        </p>
      ) : null}
      {query.token ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Development invitation link:{" "}
          <Link href={`/invitations/accept?token=${encodeURIComponent(query.token)}`} className="font-semibold underline">
            open invitation
          </Link>
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <form action={inviteEmployerMemberAction} className="grid content-start gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-xl font-semibold">Invite organization user</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The recipient must accept using this exact email address.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Email address
            <input name="email" type="email" required className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Access role
            <select name="role" required className="min-h-11 rounded-md border border-zinc-300 bg-white px-3">
              {getEmployerRoles().map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
            </select>
          </label>
          <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
            Create invitation
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-xl font-semibold">Organization members</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {data.members.map((membership) => (
              <div key={membership.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-semibold">{membership.user.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">{membership.user.email}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatRole(membership.role)} · {membership.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                {membership.isActive ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={changeEmployerMemberRoleAction} className="flex gap-2">
                      <input type="hidden" name="membershipId" value={membership.id} />
                      <select name="role" defaultValue={membership.role} aria-label={`Role for ${membership.user.name}`} className="min-h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm">
                        {getEmployerRoles().map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
                      </select>
                      <button className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold">
                        Update role
                      </button>
                    </form>
                    <form action={deactivateEmployerMemberAction}>
                      <input type="hidden" name="membershipId" value={membership.id} />
                      <input type="hidden" name="reason" value="Access removed by employer administrator." />
                      <button className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold">
                        Deactivate
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={reactivateEmployerMemberAction}>
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <button className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold">
                      Reactivate
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-xl font-semibold">Pending invitations</h2>
        </div>
        {data.invitations.length === 0 ? (
          <p className="px-5 py-5 text-sm text-zinc-600">No pending invitations.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {data.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{invitation.email}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatRole(invitation.role)} · expires {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <form action={revokeEmployerInvitationAction}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <button className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold">
                    Revoke
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
