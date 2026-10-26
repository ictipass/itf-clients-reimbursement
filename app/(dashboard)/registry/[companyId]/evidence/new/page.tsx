import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { getServerSession } from "next-auth";

import { uploadCompanyEvidenceAction } from "@/app/(dashboard)/registry/[companyId]/evidence/actions";
import { EvidenceTypeField } from "@/app/(dashboard)/registry/[companyId]/evidence/evidence-type-field";
import { authOptions } from "@/lib/auth";
import { getCompanyEvidenceKinds } from "@/lib/evidence";
import { getEmployerCompany } from "@/lib/registry";
import { notFound } from "next/navigation";

const evidenceLabels: Record<string, string> = {
  CAC_CERTIFICATE: "CAC certificate",
  TAX_CLEARANCE_CERTIFICATE: "Tax Clearance Certificate",
  AUDITED_ACCOUNT: "Audited account",
  OTHER_SUPPORTING_EVIDENCE: "Other supporting evidence",
};

export default async function NewEvidencePage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string }>;
}>) {
  const { companyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const company = await getEmployerCompany(companyId, {
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <Link href={`/registry/${company.id}`} className="text-sm font-semibold text-[#800020]">
        Back to company
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Upload evidence</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        Add registration evidence for {company.legalName}. This first upload slice accepts
        private PDF, JPEG, and PNG files up to 10 MB.
      </p>

      <form
        action={uploadCompanyEvidenceAction}
        className="mt-6 grid gap-6 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <input type="hidden" name="companyId" value={company.id} />

        <EvidenceTypeField
          options={getCompanyEvidenceKinds().map((kind) => ({
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
            className="rounded-md border border-zinc-300 bg-white px-3 py-2"
          />
        </label>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          Files are stored outside the public web folder, renamed with a random object key,
          and checked by MIME type and file signature before metadata is saved.
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
          <Link
            href={`/registry/${company.id}`}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Upload evidence
          </button>
        </div>
        <FormActionProgress />
      </form>
    </div>
  );
}
