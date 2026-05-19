import Link from "next/link";
import { notFound } from "next/navigation";

import { uploadComplianceEvidenceAction } from "@/app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/evidence/actions";
import {
  getComplianceEvidenceKinds,
  getComplianceYearForUpload,
  type ComplianceEvidenceKind,
} from "@/lib/compliance";

const evidenceLabels: Record<ComplianceEvidenceKind, string> = {
  CONTRIBUTION_RECEIPT: "Contribution receipt",
  LEARNING_POLICY: "Learning and development policy",
  TRAINING_POLICY: "Training policy",
  ANNUAL_TRAINING_PLAN: "Annual training plan",
  SIGNED_DECLARATION: "Signed declaration",
  OFFICIAL_STAMPED_COPY: "Official stamped copy",
  OTHER_SUPPORTING_EVIDENCE: "Other supporting evidence",
};

export default async function NewComplianceEvidencePage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string; complianceYearId: string }>;
}>) {
  const { companyId, complianceYearId } = await params;
  const complianceYear = await getComplianceYearForUpload(companyId, complianceYearId);

  if (!complianceYear) {
    notFound();
  }

  const action = uploadComplianceEvidenceAction.bind(null, companyId, complianceYearId);
  const evidenceKinds = getComplianceEvidenceKinds();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <Link href={`/registry/${companyId}`} className="text-sm font-semibold text-[#800020]">
        Back to company
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Upload compliance evidence</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Add evidence for {complianceYear.company.legalName} for compliance year{" "}
        {complianceYear.year}. This upload flow accepts PDF, JPEG, and PNG files up to 10MB.
      </p>

      <form action={action} className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6">
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
            accept="application/pdf,image/jpeg,image/png"
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
