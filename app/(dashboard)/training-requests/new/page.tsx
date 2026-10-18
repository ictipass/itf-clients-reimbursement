import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createAdHocTrainingRequestAction } from "@/app/(dashboard)/training-requests/new/actions";
import { TrainingPlanSourcePicker } from "@/app/(dashboard)/training-requests/new/training-plan-source-picker";
import { authOptions } from "@/lib/auth";
import { listApprovedTrainingPlanRows, listEmployerTrainingRequestCompanies } from "@/lib/training-request";

export default async function NewTrainingRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/sign-in");

  const companies = await listEmployerTrainingRequestCompanies({
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });
  const planRows = await listApprovedTrainingPlanRows({
    companyIds: companies.map((company) => company.id),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
      <Link href="/training-requests" className="text-sm font-semibold text-[#800020]">
        Back to Training Requests
      </Link>
      <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Form 4A approval
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Request Approval for Training</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Complete a Form 4A for each training. Link an approved Training Plan row when the
          training appears in a plan; otherwise leave the source unlinked.
        </p>

        <form action={createAdHocTrainingRequestAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <TrainingPlanSourcePicker companies={companies} planRows={planRows} />
          <label className="grid gap-2 text-sm font-medium">
            Training title
            <input name="title" required className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Provider
            <input name="provider" required className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Delivery
            <select name="deliveryMode" required className="min-h-11 rounded-md border border-zinc-300 px-3">
              <option value="LOCAL_PHYSICAL">Local physical</option>
              <option value="LOCAL_ONLINE">Local online</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Venue (physical training)
            <input name="venue" className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Starts
            <input name="startsAt" type="datetime-local" required className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Ends
            <input name="endsAt" type="datetime-local" required className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Estimated cost (NGN)
            <input name="estimatedCost" type="number" min="0.01" step="0.01" required className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Additional context (optional)
            <textarea name="adHocJustification" rows={3} className="rounded-md border border-zinc-300 px-3 py-2" />
          </label>
          <button className="min-h-11 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white md:col-span-2">
            Create draft request
          </button>
        </form>
      </section>
    </div>
  );
}
