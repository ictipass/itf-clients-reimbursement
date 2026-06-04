import Link from "next/link";

import { CsvPreviewClient } from "@/app/(dashboard)/training-plans/csv-preview/csv-preview-client";

export default function TrainingPlanCsvPreviewPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <Link href="/training-plans" className="text-sm font-semibold text-[#800020]">
        Back to Training Plans
      </Link>
      <div className="mt-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          CSV preview
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Training Plan CSV parser preview
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Validate the annual training plan CSV columns and preview rows before importing them into
          a submission.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <CsvPreviewClient />
      </section>
    </div>
  );
}
