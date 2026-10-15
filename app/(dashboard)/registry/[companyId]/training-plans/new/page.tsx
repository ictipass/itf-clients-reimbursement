import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { createTrainingPlanSubmissionAction } from "@/app/(dashboard)/registry/[companyId]/training-plans/actions";
import { PersonnelFields } from "@/app/(dashboard)/registry/[companyId]/training-plans/new/personnel-fields";
import { authOptions } from "@/lib/auth";
import { getEmployerCompany } from "@/lib/registry";
import { usesInAppRevenueWorkflow } from "@/lib/revenue-workflow";

export default async function NewTrainingPlanSubmissionPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ error?: string | string[]; year?: string | string[] }>;
}>) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const company = await getEmployerCompany(companyId, {
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  if (!company) {
    notFound();
  }
  if (session.user.role !== "EMPLOYER_ADMIN" && session.user.role !== "EMPLOYER_SUBMITTER") {
    notFound();
  }

  const action = createTrainingPlanSubmissionAction.bind(null, company.id);
  const currentYear = new Date().getFullYear();
  const createError = Array.isArray(query.error) ? query.error[0] : query.error;
  const requestedYear = Array.isArray(query.year) ? query.year[0] : query.year;
  const defaultYear = requestedYear && Number.isInteger(Number(requestedYear))
    ? Number(requestedYear)
    : currentYear;
  const hasCurrentYearCertifiedCompliance = company.complianceYears.some(
    (complianceYear) =>
      complianceYear.year === currentYear &&
      complianceYear.status === "APPROVED" &&
      complianceYear.certificate,
  );
  const integrated = usesInAppRevenueWorkflow(company.organization.workspace.revenueWorkflowMode);

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

      {integrated && !hasCurrentYearCertifiedCompliance ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-semibold">Current-year compliance is required</p>
          <p className="mt-2 max-w-3xl leading-6">
            Training Plan and L&amp;D submission opens after {company.legalName}&apos;s{" "}
            {currentYear} annual compliance is approved and its compliance certificate has been
            issued.
          </p>
          <Link
            href={`/registry/${company.id}`}
            className="mt-4 inline-flex min-h-10 items-center rounded-md border border-amber-200 bg-white px-3 text-sm font-semibold text-amber-900"
          >
            Return to company profile
          </Link>
        </div>
      ) : (
        <>
      {!integrated ? <p className="mb-5 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">The ITF number will be checked against the compliance API for the selected training year. If it is unavailable, this submission can be prepared while verification remains pending; approval will wait.</p> : null}
      {createError ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">Submission was not created</p>
              <p className="mt-1 leading-6">{createError}</p>
            </div>
            <Link
              href={`/registry/${company.id}`}
              className="inline-flex min-h-9 w-fit items-center rounded-md border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-900"
            >
              View existing submissions
            </Link>
          </div>
        </div>
      ) : null}

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
              defaultValue={defaultYear}
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
        </>
      )}
    </div>
  );
}
