import Link from "next/link";
import { notFound } from "next/navigation";

import { TrainingPlanEvidenceUploadForm } from "./training-plan-evidence-upload-form";

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

      {submission.status !== "DRAFT" ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Submitted training-plan files and rows are locked. A correction request permits company-detail changes only.</p>
      ) : <>

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

      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm" aria-label="Current evidence status">
        <p className="font-semibold text-zinc-900">Current evidence</p>
        <p className="mt-1 text-xs text-zinc-600">Select the missing files together, or select an existing file to replace it. Both evidence types are required before submitting the plan for review.</p>
        <ul className="mt-3 grid gap-2">
          <li>Training plan: {submission.documents.find((document) => document.kind === "TRAINING_PLAN_DOCUMENT")?.fileName ?? "Not uploaded"}</li>
          <li>L&amp;D CV and qualification certificate: {submission.documents.find((document) => document.kind === "LD_PERSONNEL_CV")?.fileName ?? "Not uploaded"}</li>
        </ul>
      </div>

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

      <TrainingPlanEvidenceUploadForm companyId={companyId} submissionId={submissionId}
        hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)} />
      </>}
    </div>
  );
}
