import { FormActionProgress } from "@/components/form-action-progress";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { createJurisdictionChangeRequestAction, decideJurisdictionChangeRequestAction } from "@/app/(dashboard)/jurisdiction-requests/actions";
import { authOptions } from "@/lib/auth";
import { listJurisdictionChangeData } from "@/lib/jurisdiction-change";

export default async function JurisdictionRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/sign-in");
  const data = await listJurisdictionChangeData({
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Employer jurisdiction</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Area Office change requests</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">Employers request a transfer; the current Area Office reviews and either grants or rejects it.</p>

      {data.canRequest ? (
        <form action={createJurisdictionChangeRequestAction} className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Company
            <select name="companyId" required className="min-h-10 rounded-md border border-zinc-200 px-3">
              <option value="">Select company</option>
              {data.companies.map((company) => <option key={company.id} value={company.id}>{company.legalName} · {company.areaOffice?.name ?? "Unassigned"}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">Requested Area Office
            <select name="toAreaOfficeId" required className="min-h-10 rounded-md border border-zinc-200 px-3">
              <option value="">Select office</option>
              {data.offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">Reason
            <textarea name="reason" required rows={3} className="rounded-md border border-zinc-200 px-3 py-2" />
          </label>
          <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Submit request</button>
          <FormActionProgress />
        </form>
      ) : null}

      <section className="mt-6 grid gap-3">
        {data.requests.map((request) => (
          <article key={request.id} className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-zinc-950">{request.company.legalName}</h2>
                <p className="mt-1 text-sm text-zinc-600">{request.fromAreaOffice?.name ?? "Unassigned"} → {request.toAreaOffice.name}</p>
                <p className="mt-2 text-sm text-zinc-700">{request.reason}</p>
                {request.reviewNote ? <p className="mt-2 text-sm text-zinc-500">Review note: {request.reviewNote}</p> : null}
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold">{request.status}</span>
            </div>
            {data.canReview && request.status === "PENDING" ? (
              <form action={decideJurisdictionChangeRequestAction.bind(null, request.id)} className="mt-4 flex flex-wrap gap-2">
                <input name="reviewNote" placeholder="Review note" className="min-h-9 flex-1 rounded-md border border-zinc-200 px-3 text-sm" />
                <button name="decision" value="APPROVED" className="rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white">Grant</button>
                <button name="decision" value="REJECTED" className="rounded-md bg-red-700 px-3 text-sm font-semibold text-white">Reject</button>
                <FormActionProgress />
              </form>
            ) : null}
          </article>
        ))}
        {data.requests.length === 0 ? <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">No jurisdiction requests yet.</p> : null}
      </section>
    </div>
  );
}
