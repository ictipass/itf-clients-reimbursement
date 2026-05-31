import Link from "next/link";
import { notFound } from "next/navigation";

import { createTrainingPlanSubmissionAction } from "@/app/(dashboard)/registry/[companyId]/training-plans/actions";
import { PersonnelFields } from "@/app/(dashboard)/registry/[companyId]/training-plans/new/personnel-fields";
import { getEmployerCompany } from "@/lib/registry";

export default async function NewTrainingPlanSubmissionPage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string }>;
}>) {
  const { companyId } = await params;
  const company = await getEmployerCompany(companyId);

  if (!company) {
    notFound();
  }

  const action = createTrainingPlanSubmissionAction.bind(null, company.id);
  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <Link href={`/registry/${company.id}`} className="text-sm font-semibold text-[#800020]">
          Back to company
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Create Training Plan and L&amp;D submission
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Capture the yearly Form 3A personnel details and prepare the annual training plan
          evidence for {company.legalName}.
        </p>
      </div>

      <form action={action} className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-6">
        <section className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Submission year
            <input
              name="year"
              type="number"
              min="2000"
              max={currentYear + 1}
              required
              defaultValue={currentYear}
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
        </section>

        <PersonnelFields />

        <label className="grid gap-2 border-t border-zinc-100 pt-6 text-sm font-medium">
          Training plan summary
          <textarea
            name="trainingPlanSummary"
            rows={5}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
          <Link
            href={`/registry/${company.id}`}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Create submission
          </button>
        </div>
      </form>
    </div>
  );
}
