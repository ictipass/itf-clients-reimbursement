import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAttentionSummary, getModuleAttentionCounts } from "@/lib/attention";
import { appName } from "@/lib/domain";
import { getVisibleNavGroups } from "@/lib/navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
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
            <div className="grid gap-2 text-sm">
              <span className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-700">
                {activeRole}
              </span>
              <Link
                href="/api/auth/signin"
                className="inline-flex min-h-9 items-center justify-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
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
