"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { VisibleNavGroup } from "@/lib/navigation";

type DashboardNavProps = {
  groups: VisibleNavGroup[];
  moduleAttentionCounts: Record<string, number>;
  attentionBadgeTitle: string;
  className?: string;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
  groups,
  moduleAttentionCounts,
  attentionBadgeTitle,
  className = "",
}: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav className={`grid gap-5 overflow-x-auto pb-1 lg:overflow-y-auto lg:pb-6 ${className}`}>
      {groups.map((group) => (
        <section key={group.label} className="min-w-48">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {group.label}
          </p>
          <div className="mt-2 grid gap-1">
            {group.items.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#800020] text-white"
                      : "text-zinc-700 hover:bg-[#800020]/10 hover:text-[#800020]"
                  }`}
                >
                  <span>{item.label}</span>
                  {(moduleAttentionCounts[item.module] ?? 0) > 0 ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive ? "bg-white text-[#800020]" : "bg-[#800020] text-white"
                      }`}
                      title={attentionBadgeTitle}
                    >
                      {moduleAttentionCounts[item.module]}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
