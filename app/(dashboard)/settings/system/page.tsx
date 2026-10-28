import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatRevenueWorkflowMode } from "@/lib/revenue-workflow";

const settingAreas = [
  {
    href: "/settings/operating-model",
    title: "Contribution operating model",
    description:
      "Control external contribution verification versus end-to-end contribution processing.",
  },
  {
    href: "/settings/claims",
    title: "Claim settings",
    description: "Manage reimbursement policy information and claim-submission deadlines.",
  },
  {
    href: "/settings/users",
    title: "Users and access",
    description: "Manage workspace users, roles, and administrative access.",
  },
  {
    href: "/settings/assignment-recovery",
    title: "Stranded assignments",
    description: "Locate and reassign jobs whose named officer no longer has access.",
  },
  {
    href: "/settings/offices",
    title: "Offices and organization",
    description: "Configure Headquarters, Area Offices, and staff assignments.",
  },
] as const;

export default async function SystemSettingsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";

  if (!can(role, "workspace:manage")) {
    return (
      <p className="p-8 text-sm text-zinc-600">
        You do not have permission to manage system settings.
      </p>
    );
  }

  const workspace = await getDb().workspace.findFirst({
    where: {
      isActive: true,
    },
    select: {
      name: true,
      revenueWorkflowMode: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const hasIntegratedWorkspace = await getDb().workspace.count({ where: { isActive: true, revenueWorkflowMode: "IN_APP_REVENUE" } }) > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Administration
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">System settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Manage workspace-wide operating policies and platform configuration. Personal
          preferences remain under My Settings.
        </p>

        <div className="mt-6 rounded-lg border border-[#800020]/20 bg-[#800020]/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020]">
            Current contribution operating model
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">
            {workspace
              ? formatRevenueWorkflowMode(workspace.revenueWorkflowMode)
              : "No active workspace"}
          </p>
          {workspace ? <p className="mt-1 text-sm text-zinc-600">{workspace.name}</p> : null}
          <Link
            href="/settings/operating-model"
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
          >
            Configure operating model
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[...settingAreas, { href: "/settings/banks", title: "Accepted banks", description: "Maintain banks and sort codes for reimbursement claims." }, ...(hasIntegratedWorkspace ? [{ href: "/settings/numbers", title: "Number registries", description: "Manage registration and certificate identifiers." }] : [])].map((area) => (
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
