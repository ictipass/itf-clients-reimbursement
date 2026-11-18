"use client";

import Link from "next/link";
import { useState } from "react";

import { FormActionProgress } from "@/components/form-action-progress";
import { HostedFileInput, type HostedFileState } from "@/components/hosted-file-input";

type FileKind = "trainingPlanCsv" | "personnelCv";

export function TrainingPlanEvidenceUploadForm({ companyId, submissionId, hosted }: {
  companyId: string;
  submissionId: string;
  hosted: boolean;
}) {
  const [files, setFiles] = useState<Record<FileKind, HostedFileState>>({
    trainingPlanCsv: "empty",
    personnelCv: "empty",
  });
  const readyCount = Object.values(files).filter((state) => state === "ready").length;
  const pending = Object.values(files).some((state) => state === "uploading");
  const error = Object.values(files).some((state) => state === "error");
  const canSubmit = readyCount > 0 && !pending && !error;

  function updateFile(kind: FileKind, state: HostedFileState) {
    setFiles((current) => ({ ...current, [kind]: state }));
  }

  return (
    <form
      id="training-plan-evidence-form"
      action={`/registry/${companyId}/training-plans/${submissionId}/evidence/upload`}
      method="post"
      encType="multipart/form-data"
      className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6"
      onSubmit={(event) => { if (!canSubmit) event.preventDefault(); }}
    >
      <label className="grid gap-2 text-sm font-medium">
        Annual training plan CSV or Excel (.xlsx) (also imports its rows)
        <HostedFileInput hosted={hosted} name="trainingPlanCsv"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          onStateChange={(state) => updateFile("trainingPlanCsv", state)}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        L&amp;D personnel CV and highest qualification certificate (one PDF is accepted)
        <HostedFileInput hosted={hosted} name="personnelCv"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          onStateChange={(state) => updateFile("personnelCv", state)}
        />
      </label>
      <div className="rounded-md bg-zinc-50 p-3 text-xs leading-5 text-zinc-700" role="status">
        <p>Select either file or both. Wait for every selected file to be ready, then submit them together. Each file must be 10 MB or smaller.</p>
        <p className="mt-1 font-semibold">{pending ? "Preparing selected files…" : error ? "A file could not be prepared. Choose it again before submitting." : `${readyCount} of 2 files ready.`}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
        <Link href={`/training-plans/${submissionId}`} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold">Cancel</Link>
        <button disabled={!canSubmit} className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300">Upload selected files</button>
      </div>
      <FormActionProgress />
    </form>
  );
}
