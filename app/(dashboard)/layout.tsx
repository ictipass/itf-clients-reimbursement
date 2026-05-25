import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAttentionSummary } from "@/lib/attention";
import { appName } from "@/lib/domain";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/registry", label: "Registry" },
  { href: "/compliance", label: "Compliance" },
  { href: "/claims", label: "Claims" },
  { href: "/settings/certificates", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const attentionSummary = await getAttentionSummary({
    requesterEmail: session?.user?.email,
    requesterRole: session?.user?.role ?? "SYSTEM_ADMIN",
    take: 0,
  });

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              {appName}
              {attentionSummary.total > 0 ? (
                <span className="ml-2 rounded-full bg-[#800020] px-2 py-0.5 text-xs font-semibold text-white">
                  {attentionSummary.total}
                </span>
              ) : null}
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-700">
                {session?.user?.role ?? "SYSTEM_ADMIN"}
              </span>
              <Link
                href="/api/auth/signin"
                className="rounded-full bg-[#800020] px-4 py-2 font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-[#800020]/40 hover:text-[#800020]"
              >
                <span>{item.label}</span>
                {item.href === "/registry" && attentionSummary.total > 0 ? (
                  <span className="ml-2 rounded-full bg-[#800020] px-2 py-0.5 text-xs font-semibold text-white">
                    {attentionSummary.total}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
