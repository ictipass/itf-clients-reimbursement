import Link from "next/link";
import { notFound } from "next/navigation";

import { getEmployerCompany } from "@/lib/registry";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatMoney(value: { toString(): string } | null) {
  if (!value) {
    return "Not provided";
  }

  return `NGN ${Number(value.toString()).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function DetailItem({
  label,
  value,
}: Readonly<{
  label: string;
  value: React.ReactNode;
}>) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="mt-2 text-sm font-medium leading-6 text-zinc-950">{value}</div>
    </div>
  );
}

export default async function CompanyDetailPage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string }>;
}>) {
  const { companyId } = await params;
  const company = await getEmployerCompany(companyId);

  if (!company) {
    notFound();
  }

  const registrationState = company.itfEmployerNumber
    ? "Registered with ITF"
    : "Not yet registered with ITF";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <Link href="/registry" className="text-sm font-semibold text-[#800020]">
        Back to registry
      </Link>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Employer profile
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{company.legalName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Form 7A profile, ITF registration state, supporting evidence summary, and
            compliance history for this employer company.
          </p>
        </div>
        <div className="grid gap-2 text-sm md:min-w-64">
          <span className="rounded-full bg-[#800020]/10 px-4 py-2 text-center font-semibold text-[#65001a]">
            {company.status.replaceAll("_", " ")}
          </span>
          <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-center font-semibold text-zinc-700">
            {registrationState}
          </span>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Organization" value={company.organization.name} />
        <DetailItem label="ITF employer number" value={company.itfEmployerNumber ?? "Pending"} />
        <DetailItem label="RC number" value={company.rcNumber ?? "Not provided"} />
        <DetailItem label="Tax ID" value={company.taxId ?? "Not provided"} />
        <DetailItem label="Email address" value={company.email ?? "Not provided"} />
        <DetailItem label="Telephone number" value={company.telephone ?? "Not provided"} />
        <DetailItem label="Nature of business" value={company.natureOfBusiness ?? "Not provided"} />
        <DetailItem label="Established date" value={formatDate(company.establishedAt)} />
        <DetailItem label="Payroll basis" value={formatMoney(company.payrollBasis)} />
        <DetailItem label="Business address" value={company.businessAddress ?? "Not provided"} />
        <DetailItem label="Postal address" value={company.postalAddress ?? "Not provided"} />
        <DetailItem label="Last updated" value={formatDate(company.updatedAt)} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Evidence summary</h2>
            <Link
              href={`/registry/${company.id}/evidence/new`}
              className="inline-flex min-h-10 items-center rounded-md bg-[#800020] px-3 text-sm font-semibold text-white"
            >
              Upload evidence
            </Link>
          </div>
          {company.documents.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No supporting evidence has been uploaded for this company yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {company.documents.map((document) => (
                <div key={document.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                  <p className="font-semibold">{document.fileName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {document.kind.replaceAll("_", " ")} · {formatDate(document.createdAt)}
                  </p>
                  <Link
                    href={`/registry/${company.id}/evidence/${document.id}`}
                    className="mt-3 inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                  >
                    Download
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Compliance years</h2>
            <Link
              href={`/registry/${company.id}/compliance/new`}
              className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
            >
              Create year
            </Link>
          </div>
          {company.complianceYears.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No annual compliance returns have been created for this company yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {company.complianceYears.map((complianceYear) => (
                <div
                  key={complianceYear.id}
                  className="grid gap-2 rounded-md border border-zinc-100 p-3 text-sm md:grid-cols-3"
                >
                  <p className="font-semibold">{complianceYear.year}</p>
                  <p>{complianceYear.status.replaceAll("_", " ")}</p>
                  <p>{formatMoney(complianceYear.amountPaid)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
