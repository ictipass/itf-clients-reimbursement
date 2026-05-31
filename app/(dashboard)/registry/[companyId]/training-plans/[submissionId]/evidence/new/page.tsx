import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getTrainingPlanEvidenceKinds,
  getTrainingPlanSubmissionForUpload,
  type TrainingPlanEvidenceKind,
} from "@/lib/training-plan";

const evidenceLabels: Record<TrainingPlanEvidenceKind, string> = {
  TRAINING_PLAN_DOCUMENT: "Annual training plan document",
  LD_PERSONNEL_CV: "L&D personnel CV",
};

export default async function NewTrainingPlanEvidencePage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string; submissionId: string }>;
}>) {
  const { companyId, submissionId } = await params;
  const submission = await getTrainingPlanSubmissionForUpload(companyId, submissionId);

  if (!submission) {
    notFound();
  }

  const evidenceKinds = getTrainingPlanEvidenceKinds();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <Link href={`/registry/${companyId}`} className="text-sm font-semibold text-[#800020]">
        Back to company
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Upload Training Plan evidence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Add evidence for {submission.company.legalName} for Training Plan and L&amp;D submission{" "}
        {submission.year}. Annual training plan documents must use the CSV template. L&amp;D
        personnel CV uploads accept PDF, JPEG, and PNG files up to 10MB.
      </p>
      <Link
        href={`/registry/${companyId}/training-plans/template`}
        className="mt-4 inline-flex min-h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800"
      >
        Download CSV template
      </Link>

      <form
        action={`/registry/${companyId}/training-plans/${submissionId}/evidence/upload`}
        method="post"
        encType="multipart/form-data"
        className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <label className="grid gap-2 text-sm font-medium">
          Evidence type
          <select
            name="kind"
            required
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
          >
            <option value="">Select evidence type</option>
            {evidenceKinds.map((kind) => (
              <option key={kind} value={kind}>
                {evidenceLabels[kind]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Evidence file
          <input
            name="file"
            type="file"
            required
            accept=".csv,text/csv,application/pdf,image/jpeg,image/png"
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
          <Link
            href={`/registry/${companyId}`}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Upload evidence
          </button>
        </div>
      </form>
    </div>
  );
}
