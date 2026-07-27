import { getServerSession } from "next-auth";

import { SettingsTabs } from "@/app/(dashboard)/settings/SettingsTabs";
import { authOptions } from "@/lib/auth";
import { can, canManageClaimPolicy } from "@/lib/rbac";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const tabs = [
    { href: "/settings", label: "Settings home", visible: true },
    { href: "/settings/preferences", label: "Personal preferences", visible: true },
    {
      href: "/settings/operating-model",
      label: "Contribution operating model",
      visible: canManageClaimPolicy(role),
    },
    {
      href: "/settings/claims",
      label: "Claims",
      visible: canManageClaimPolicy(role),
    },
    {
      href: "/settings/system",
      label: "System administration",
      visible: can(role, "workspace:manage"),
    },
  ]
    .filter((tab) => tab.visible)
    .map(({ href, label }) => ({ href, label }));

  return (
    <>
      <SettingsTabs tabs={tabs} />
      {children}
    </>
  );
}
