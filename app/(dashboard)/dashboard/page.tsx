import Link from "next/link";

import { dashboardMetrics, seedRoles, workflowStages } from "@/lib/domain";
import { getPermissions } from "@/lib/rbac";

export default function DashboardPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Foundation
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            Workspace-aware reimbursement operations are now scaffolded.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-650">
            The first implementation layer defines the domain schema, role model, audit
            contract, Auth.js bootstrap path, and dashboard routes needed before live
            employer records and claim workflows are added.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/registry"
              className="rounded-full bg-[#800020] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Registry queue
            </Link>
            <Link
              href="/claims"
              className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Claims desk
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {dashboardMetrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-zinc-200 bg-white p-5">
              <p className="text-3xl font-semibold text-[#800020]">{metric.value}</p>
              <p className="mt-2 text-sm font-semibold">{metric.label}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Workflow modules</h2>
          <p className="mt-1 text-sm text-zinc-600">
            These modules map directly to the Prisma models and RBAC permissions.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workflowStages.map((stage) => (
            <article key={stage.key} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{stage.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#800020]/10 px-3 py-1 text-xs font-semibold text-[#65001a]">
                  {stage.status}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {stage.owner}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stage.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Seed role model</h2>
        <div className="mt-5 grid gap-3">
          {seedRoles.map((item) => (
            <div
              key={item.role}
              className="grid gap-3 border-t border-zinc-100 pt-3 md:grid-cols-[15rem_8rem_1fr]"
            >
              <p className="font-mono text-sm font-semibold text-[#800020]">{item.role}</p>
              <p className="text-sm font-medium text-zinc-700">{item.scope}</p>
              <p className="text-sm leading-6 text-zinc-600">
                {item.purpose} Permissions: {getPermissions(item.role).join(", ")}.
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
