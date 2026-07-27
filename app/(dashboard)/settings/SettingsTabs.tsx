"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SettingsTab = {
  href: string;
  label: string;
};

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="overflow-x-auto border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 px-6 lg:px-8">
        {tabs.map((tab) => {
          const active = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-4 text-sm font-semibold ${
                active
                  ? "border-[#800020] text-[#800020]"
                  : "border-transparent text-zinc-600 hover:text-zinc-950"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
