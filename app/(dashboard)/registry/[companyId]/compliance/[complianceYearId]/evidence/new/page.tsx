import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { notFound } from "next/navigation";

import {
  attachExistingPaymentEvidenceAction,
  uploadComplianceEvidenceAction,
} from "@/app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/evidence/actions";
import { EvidenceTypeField } from "@/app/(dashboard)/registry/[companyId]/evidence/evidence-type-field";
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
  const attachAction = attachExistingPaymentEvidenceAction.bind(null, companyId, complianceYearId);
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

      {complianceYear.company.documents.length > 0 ? (
        <form
          action={attachAction}
          className="mt-6 grid gap-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-6"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Use existing payment evidence</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Select a contribution receipt already uploaded during registration. The secured file
              will be linked to this compliance year without uploading it again.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Existing contribution receipt
            <select
              name="documentId"
              required
              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
            >
              <option value="">Select payment evidence</option>
              {complianceYear.company.documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.fileName} ·{" "}
                  {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                    document.createdAt,
                  )}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-11 w-fit rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Attach selected receipt
          </button>
        </form>
      ) : null}

      <form action={action} className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6">
        <EvidenceTypeField
          options={evidenceKinds.map((kind) => ({
            value: kind,
            label: evidenceLabels[kind],
          }))}
        />

        <label className="grid gap-2 text-sm font-medium">
          Evidence file
          <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
            name="file"
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
