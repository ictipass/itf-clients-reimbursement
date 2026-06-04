import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAttentionSummary } from "@/lib/attention";
import { listEmployerDashboardActions } from "@/lib/dashboard-work-queue";
import { dashboardMetrics, workflowStages } from "@/lib/domain";

function formatRole(value: string | null) {
  return value ? value.replaceAll("_", " ") : "Unassigned";
}

function formatKind(value: string) {
  return value.replaceAll("_", " ");
}

function getQueueBadgeClass(category: string) {
  if (category === "AWARENESS") {
    return "border-[#0f766e]/20 bg-[#0f766e]/10 text-[#115e59]";
  }

  return "border-[#800020]/20 bg-[#800020]/10 text-[#65001a]";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const attentionSummary = await getAttentionSummary({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
    take: 8,
  });
  const employerActions = await listEmployerDashboardActions({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
    take: 5,
  });
  const hasWorkQueue = attentionSummary.items.length > 0 || employerActions.length > 0;
  const actionCount = attentionSummary.actionTotal + employerActions.length;
  const awarenessCount = attentionSummary.awarenessTotal;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Desk</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            Your reimbursement work queue
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Signed in as <span className="font-semibold text-zinc-950">{formatRole(activeRole)}</span>.
            Action items need your desk decision. Awareness items keep you informed about filings in
            your office or workspace scope.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={attentionSummary.items[0]?.targetHref ?? employerActions[0]?.targetHref ?? "/registry"}
              className="rounded-full bg-[#800020] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue next item
            </Link>
            <Link
              href="/registry"
              className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Open registry
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

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">My work queue</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Open workflow tasks and employer-side actions that need attention.
            </p>
          </div>
          <span className="inline-flex min-h-9 items-center rounded-full bg-[#800020]/10 px-3 text-sm font-semibold text-[#65001a]">
            {actionCount} action · {awarenessCount} awareness
          </span>
        </div>
        {!hasWorkQueue ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No pending attention items for your desk.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {attentionSummary.items.map((item) => (
              <Link
                key={item.id}
                href={item.targetHref}
                className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${getQueueBadgeClass(item.queueCategory)}`}
                    >
                      {item.queueLabel}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                      {item.priority}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-6 text-zinc-600">
                  {item.summary ?? item.company?.legalName ?? "Open workflow item"}
                </p>
                <p className="text-xs leading-5 text-zinc-500">
                  {formatKind(item.kind)} · {formatRole(item.assignedRole)} ·{" "}
                  {item.areaOffice?.name ?? item.organization?.name ?? "Workspace"} ·{" "}
                  {formatDate(item.createdAt)}
                </p>
              </Link>
            ))}
            {employerActions.map((item) => (
              <Link
                key={item.id}
                href={item.targetHref}
                className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {item.priority}
                  </span>
                </div>
                <p className="text-sm leading-6 text-zinc-600">{item.summary}</p>
                <p className="text-xs leading-5 text-zinc-500">
                  Employer action · {item.companyName} · {formatDate(item.createdAt)}
                </p>
              </Link>
            ))}
            {attentionSummary.total > attentionSummary.items.length ? (
              <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Showing {attentionSummary.items.length} of {attentionSummary.total} routed work
                items.
              </p>
            ) : null}
          </div>
        )}
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

    </div>
  );
}
