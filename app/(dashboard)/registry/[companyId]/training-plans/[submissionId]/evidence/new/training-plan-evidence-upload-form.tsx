"use client";

import Link from "next/link";
import { useState } from "react";

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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const readyCount = Object.values(files).filter((state) => state === "ready").length;
  const pending = Object.values(files).some((state) => state === "uploading");
  const error = Object.values(files).some((state) => state === "error");
  const canSubmit = readyCount > 0 && !pending && !error && !submitting;

  function updateFile(kind: FileKind, state: HostedFileState) {
    setFiles((current) => ({ ...current, [kind]: state }));
    setSubmitError("");
  }

  async function submitFiles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(event.currentTarget.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(event.currentTarget),
      });
      const result = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as { error?: string; redirect?: string }
        : {};
      if (!response.ok || !result.redirect) {
        throw new Error(result.error || "The files could not be saved. Try again.");
      }
      window.location.assign(result.redirect);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The files could not be saved. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      id="training-plan-evidence-form"
      action={`/registry/${companyId}/training-plans/${submissionId}/evidence/upload`}
      method="post"
      encType="multipart/form-data"
      className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6"
      aria-busy={submitting}
      onSubmit={(event) => { void submitFiles(event); }}
    >
      <fieldset disabled={submitting} className="grid gap-5">
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
      </fieldset>
      <div className="rounded-md bg-zinc-50 p-3 text-xs leading-5 text-zinc-700" role="status">
        <p>Select either file or both. Wait for every selected file to be ready, then submit them together. Each file must be 10 MB or smaller.</p>
        <p className="mt-1 font-semibold">{submitting ? "Saving selected evidence and importing training plan rows…" : pending ? "Preparing selected files…" : error ? "A file could not be prepared. Choose it again before submitting." : `${readyCount} of 2 files ready.`}</p>
      </div>
      {submitError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{submitError} Your selected files remain available for retry. If an upload reference expired, remove and select that file again.</p> : null}
      <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
        <Link href={`/training-plans/${submissionId}`} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold">Cancel</Link>
        <button type="submit" disabled={!canSubmit} className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300">{submitting ? "Saving files…" : "Upload selected files"}</button>
      </div>
    </form>
  );
}
