import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { notFound } from "next/navigation";

import {
  getTrainingPlanSubmissionForUpload,
} from "@/lib/training-plan";

export default async function NewTrainingPlanEvidencePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ companyId: string; submissionId: string }>;
  searchParams: Promise<{ error?: string | string[]; kind?: string | string[] }>;
}>) {
  const { companyId, submissionId } = await params;
  const query = await searchParams;
  const submission = await getTrainingPlanSubmissionForUpload(companyId, submissionId);

  if (!submission) {
    notFound();
  }

  const uploadError = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <Link href={`/training-plans/${submissionId}`} className="text-sm font-semibold text-[#800020]">
        Back to training plan
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Upload Training Plan evidence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Add evidence for {submission.company.legalName} for Training Plan and L&amp;D submission{" "}
        {submission.year}. Annual training plans accept CSV or Excel (.xlsx) files with the template columns on the first worksheet. L&amp;D
        personnel CV evidence must also include the highest qualification certificate. You may combine the CV and certificate in one PDF (up to 10MB).
      </p>
      <Link
        href={`/registry/${companyId}/training-plans/template`}
        className="mt-4 inline-flex min-h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800"
      >
        Download CSV template
      </Link>
      <p className="mt-2 text-xs leading-5 text-zinc-600">The CSV template opens in Excel and may be saved as .xlsx. Dates may use YYYY-MM-DD, DD/MM/YYYY, or Excel date cells.</p>

      {uploadError ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">Upload was not accepted</p>
              <p className="mt-1 leading-6">{uploadError}</p>
              <p className="mt-2 text-xs leading-5 text-red-800">
                Use CSV or .xlsx for annual training plans. Use PDF, JPEG, or PNG for L&amp;D personnel
                CV and qualification certificate evidence.
              </p>
            </div>
            <a
              href="#training-plan-evidence-form"
              className="inline-flex min-h-9 w-fit items-center rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-900"
            >
              Retry upload
            </a>
          </div>
        </div>
      ) : null}

      <form
        id="training-plan-evidence-form"
        action={`/registry/${companyId}/training-plans/${submissionId}/evidence/upload`}
        method="post"
        encType="multipart/form-data"
        className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <label className="grid gap-2 text-sm font-medium">
          Annual training plan CSV or Excel (.xlsx) (also imports its rows)
          <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
            name="trainingPlanCsv"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          L&amp;D personnel CV and highest qualification certificate (one PDF is accepted)
          <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
            name="personnelCv"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
        </label>
        <p className="text-xs text-zinc-600">Select either or both files, then upload once. Each file must be 10 MB or smaller.</p>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
          <Link
            href={`/training-plans/${submissionId}`}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Upload selected files
          </button>
        </div>
        <FormActionProgress />
      </form>
    </div>
  );
}
