import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { runScheduledJobAction } from "@/app/(dashboard)/settings/scheduled-jobs/actions";
import { authOptions } from "@/lib/auth";

export default async function ScheduledJobsPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SYSTEM_ADMIN") notFound();
  const { result } = await searchParams;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
      <h1 className="text-3xl font-semibold">Scheduled jobs</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Vercel runs daily cron jobs only on this project&apos;s Production deployment. Preview staging
        requires manual runs here. Automatic runs require SCHEDULED_JOBS_ENABLED=true; manual runs do not.
      </p>
      {result ? <p role="status" className="mt-5 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{result}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Pending eligibility</h2>
          <p className="mt-2 text-sm text-zinc-600">Retry up to 50 pending company/year checks. An unavailable provider leaves them pending.</p>
          <form action={runScheduledJobAction} className="mt-4">
            <input type="hidden" name="job" value="annual-eligibility" />
            <button className="rounded-md bg-[#800020] px-4 py-2 text-sm font-semibold text-white">Run eligibility retry</button>
          </form>
        </section>
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Workflow emails</h2>
          <p className="mt-2 text-sm text-zinc-600">Send notifications for up to 50 open, unnotified high-priority work items. Real emails may be sent.</p>
          <form action={runScheduledJobAction} className="mt-4">
            <input type="hidden" name="job" value="workflow-notifications" />
            <button className="rounded-md border px-4 py-2 text-sm font-semibold">Run email dispatch</button>
          </form>
        </section>
      </div>
    </main>
  );
}
