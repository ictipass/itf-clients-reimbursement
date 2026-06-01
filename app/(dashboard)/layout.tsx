import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAttentionSummary } from "@/lib/attention";
import { appName } from "@/lib/domain";
import { can, isItfRole, type Role } from "@/lib/rbac";

type NavItem = {
  href: string;
  label: string;
  isVisible: (role: Role) => boolean;
};

const canUseRegistry = (role: Role) =>
  can(role, "company:read") || can(role, "registry:review") || can(role, "registry:submit");

const canUseCompliance = (role: Role) =>
  can(role, "compliance:review") || can(role, "compliance:submit");

const canUseClaims = (role: Role) =>
  can(role, "claims:review") || can(role, "claims:approve") || can(role, "claims:submit");

const canUseManagement = (role: Role) =>
  isItfRole(role) && (can(role, "workspace:manage") || can(role, "audit:read"));

const canUseSettings = (role: Role) => can(role, "workspace:manage");
const canUseNumbers = (role: Role) => can(role, "numbers:manage");

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", isVisible: () => true },
  { href: "/registry", label: "Registry", isVisible: canUseRegistry },
  { href: "/compliance", label: "Compliance", isVisible: canUseCompliance },
  { href: "/claims", label: "Claims", isVisible: canUseClaims },
  { href: "/management", label: "Management", isVisible: canUseManagement },
  { href: "/settings/users", label: "Users", isVisible: canUseSettings },
  { href: "/settings/offices", label: "Offices", isVisible: canUseSettings },
  { href: "/settings/roles", label: "Roles", isVisible: canUseSettings },
  { href: "/settings/numbers", label: "Numbers", isVisible: canUseNumbers },
  { href: "/settings/certificates", label: "Certificates", isVisible: canUseSettings },
  { href: "/settings/signatures", label: "Signatures", isVisible: canUseSettings },
];

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const visibleNavItems = navItems.filter((item) => item.isVisible(activeRole));
  const attentionSummary = await getAttentionSummary({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
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
                {activeRole}
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
            {visibleNavItems.map((item) => (
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
