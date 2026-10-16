import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { can, canManageClaimPolicy } from "@/lib/rbac";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const settingAreas = [
    {
      href: "/settings/preferences",
      title: "Personal preferences",
      description: "Manage your notifications and private calendar subscription.",
      visible: true,
    },
    {
      href: "/settings/operating-model",
      title: "Contribution operating model",
      description:
        "Switch between external contribution verification and end-to-end contribution processing.",
      visible: canManageClaimPolicy(role),
    },
    {
      href: "/settings/claims",
      title: "Claim settings",
      description: "Configure reimbursement policy information and claim submission deadlines.",
      visible: canManageClaimPolicy(role),
    },
    {
      href: "/settings/scheduled-jobs",
      title: "Scheduled jobs",
      description: "Run eligibility retries or workflow-email delivery and review the daily schedule.",
      visible: role === "SYSTEM_ADMIN",
    },
    {
      href: "/settings/users",
      title: "Users",
      description: "Manage workspace users and administrative access.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/staff-directory",
      title: "Departments and job titles",
      description: "Maintain approved staff directory values and download reference lists.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/roles",
      title: "Roles",
      description: "Review role responsibilities and workspace assignments.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/offices",
      title: "Offices",
      description: "Configure Headquarters and Area Offices.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/numbers",
      title: "Number registries",
      description: "Manage controlled registration and certificate identifiers.",
      visible: can(role, "numbers:manage"),
    },
    {
      href: "/settings/employers",
      title: "Employer access",
      description: "Manage employer access and organization administration.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/email",
      title: "Email delivery",
      description: "Configure workspace email delivery settings.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/certificates",
      title: "Certificates",
      description: "Manage certificate templates and presentation.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/signatures",
      title: "Signatures",
      description: "Manage authorized signature assets.",
      visible: can(role, "workspace:manage"),
    },
    {
      href: "/settings/audit",
      title: "Audit log",
      description: "Review workflow, configuration, and security events.",
      visible: can(role, "audit:read"),
    },
  ].filter((area) => area.visible);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Personal preferences and the system configuration available to your role are organized
          here.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settingAreas.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:border-[#800020]/40 hover:bg-white"
            >
              <h2 className="font-semibold text-zinc-950">{area.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{area.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
