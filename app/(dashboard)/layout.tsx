import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAttentionSummary, getModuleAttentionCounts } from "@/lib/attention";
import { appName } from "@/lib/domain";
import { getDb } from "@/lib/db";
import { getVisibleNavGroups } from "@/lib/navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const account = session?.user?.email
    ? await getDb().user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          name: true,
          email: true,
          memberships: {
            select: {
              organizationId: true,
              areaOfficeId: true,
              organization: {
                select: {
                  name: true,
                },
              },
              areaOffice: {
                select: {
                  name: true,
                },
              },
            },
            take: 3,
          },
        },
      })
    : null;
  const organizationIds =
    account?.memberships
      .map((membership) => membership.organizationId)
      .filter((value): value is string => Boolean(value)) ?? [];
  const contextCompanies =
    organizationIds.length > 0
      ? await getDb().company.findMany({
          where: {
            organizationId: {
              in: organizationIds,
            },
            recordTier: "HOT",
          },
          select: {
            id: true,
            legalName: true,
            status: true,
          },
          orderBy: {
            legalName: "asc",
          },
          take: 5,
        })
      : [];
  const visibleNavGroups = getVisibleNavGroups(activeRole);
  const attentionSummary = await getAttentionSummary({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
    take: 0,
  });
  const moduleAttentionCounts = await getModuleAttentionCounts({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
  });
  const attentionBadgeTitle = `${attentionSummary.actionTotal} action item(s), ${attentionSummary.awarenessTotal} awareness item(s)`;

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-6 px-5 py-5">
          <div className="flex flex-col gap-4">
            <Link href="/dashboard" className="text-base font-semibold tracking-tight">
              {appName}
              {attentionSummary.total > 0 ? (
                <span
                  className="ml-2 rounded-full bg-[#800020] px-2 py-0.5 text-xs font-semibold text-white"
                  title={attentionBadgeTitle}
                >
                  {attentionSummary.total}
                </span>
              ) : null}
            </Link>
            {account ? (
              <details className="group rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <summary className="cursor-pointer list-none font-semibold text-zinc-950">
                  {account.name ?? account.email}
                </summary>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-600">
                  <p>{account.email}</p>
                  <p className="font-semibold text-[#800020]">{activeRole}</p>
                  {account.memberships.map((membership) => (
                    <p key={`${membership.organization?.name}-${membership.areaOffice?.name}`}>
                      {membership.organization?.name ?? "ITF Workspace"}
                      {membership.areaOffice?.name ? ` · ${membership.areaOffice.name}` : ""}
                    </p>
                  ))}
                  <Link
                    href="/api/auth/signout"
                    className="mt-2 inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800"
                  >
                    Sign out
                  </Link>
                </div>
              </details>
            ) : (
              <Link
                href="/api/auth/signin"
                className="inline-flex min-h-9 items-center justify-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            )}
            <details className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
              <summary className="cursor-pointer list-none font-semibold text-zinc-950">
                Workspace apps
              </summary>
              <Link
                href="/dashboard"
                className="mt-3 flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm font-semibold text-zinc-800 transition hover:border-[#800020]/40"
              >
                <span>Reimbursement</span>
                {attentionSummary.total > 0 ? (
                  <span className="rounded-full bg-[#800020] px-2 py-0.5 text-xs font-semibold text-white">
                    {attentionSummary.total}
                  </span>
                ) : null}
              </Link>
            </details>
            {account ? (
              <details className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                <summary className="cursor-pointer list-none font-semibold text-zinc-950">
                  Active context
                </summary>
                <div className="mt-3 grid gap-2">
                  {contextCompanies.length > 0 ? (
                    contextCompanies.map((company) => (
                      <Link
                        key={company.id}
                        href={`/registry/${company.id}`}
                        className="rounded-md bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800"
                      >
                        {company.legalName}
                        <span className="mt-1 block font-medium text-zinc-500">
                          {company.status.replaceAll("_", " ")}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                      No employer company context linked.
                    </p>
                  )}
                  {account.memberships
                    .filter((membership) => membership.areaOffice?.name)
                    .map((membership) => (
                      <p
                        key={membership.areaOfficeId}
                        className="rounded-md bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800"
                      >
                        {membership.areaOffice?.name}
                        <span className="mt-1 block font-medium text-zinc-500">Area Office</span>
                      </p>
                    ))}
                </div>
              </details>
            ) : null}
          </div>
          <nav className="grid gap-5 overflow-x-auto pb-1 lg:overflow-y-auto lg:pb-6">
            {visibleNavGroups.map((group) => (
              <section key={group.label} className="min-w-48">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {group.label}
                </p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-semibold text-zinc-700 transition hover:bg-[#800020]/10 hover:text-[#800020]"
                    >
                      <span>{item.label}</span>
                      {(moduleAttentionCounts[item.module] ?? 0) > 0 ? (
                        <span
                          className="rounded-full bg-[#800020] px-2 py-0.5 text-xs font-semibold text-white"
                          title={attentionBadgeTitle}
                        >
                          {moduleAttentionCounts[item.module]}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
    </main>
  );
}
