import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  generateComplianceCertificatePdfAction,
  issueComplianceCertificateAction,
  updateComplianceYearStatusAction,
} from "@/app/(dashboard)/registry/[companyId]/compliance/actions";
import { authOptions } from "@/lib/auth";
import { listAvailableManagedNumbers } from "@/lib/managed-numbers";
import { canManageAnnualCompliance } from "@/lib/rbac";
import { getEmployerCompany } from "@/lib/registry";

const transitionLabels = {
  start_review: "Mark in review",
  approve: "Approve",
  request_changes: "Request correction",
  reject: "Reject",
} as const;

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

function getAvailableReviewTransitions(status: string) {
  if (status === "SUBMITTED") {
    return ["start_review", "approve", "request_changes", "reject"] as const;
  }

  if (status === "IN_REVIEW") {
    return ["approve", "request_changes", "reject"] as const;
  }

  return [] as const;
}

export default async function ComplianceReviewPage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string; complianceYearId: string }>;
}>) {
  const { companyId, complianceYearId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const company = await getEmployerCompany(companyId, {
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  if (!company) {
    notFound();
  }

  const complianceYear = company.complianceYears.find((year) => year.id === complianceYearId);

  if (!complianceYear) {
    notFound();
  }

  const activeRole = session.user.role;
  const canReviewCompliance = canManageAnnualCompliance(activeRole);
  const availableTransitions = canReviewCompliance
    ? getAvailableReviewTransitions(complianceYear.status)
    : [];
  const availableCertificateNumbers =
    canReviewCompliance && complianceYear.status === "APPROVED" && !complianceYear.certificate
      ? await listAvailableManagedNumbers({
          requesterRole: activeRole,
          workspaceId: company.organization.workspaceId,
          type: "COMPLIANCE_CERTIFICATE_NUMBER",
        })
      : [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <Link href={`/registry/${company.id}`} className="text-sm font-semibold text-[#800020]">
        Back to company
      </Link>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Compliance review
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {company.legalName} · {complianceYear.year}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Focused Headquarters review page for annual compliance evidence, decisions, and
            certificate issuance.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {complianceYear.status.replaceAll("_", " ")}
        </span>
      </div>

      {!canReviewCompliance ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This review page is for Headquarters compliance roles. You can still view the compliance
          history, but review and certificate actions are hidden for your role.
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Amount paid
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatMoney(complianceYear.amountPaid)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Contribution amount
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatMoney(complianceYear.contributionAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Certificate
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {complianceYear.certificate?.certificateNumber ?? "Not issued"}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Evidence</h2>
          {complianceYear.documents.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No compliance evidence has been uploaded for this year.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {complianceYear.documents.map((document) => (
                <div key={document.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                  <p className="font-semibold text-zinc-950">
                    {document.documentName ?? document.fileName}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {document.kind.replaceAll("_", " ")}
                    {document.documentName ? ` · ${document.fileName}` : ""} ·{" "}
                    {formatDate(document.createdAt)}
                  </p>
                  <Link
                    href={`/registry/${company.id}/evidence/${document.id}?disposition=inline`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800"
                  >
                    View evidence
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Decision trail</h2>
            {complianceYear.decisions.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                No review decision has been recorded.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {complianceYear.decisions.map((decision) => (
                  <div key={decision.id} className="rounded-md bg-zinc-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-zinc-900">
                      {decision.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 leading-5 text-zinc-600">
                      {decision.actor.name} · {formatDate(decision.createdAt)}
                      {decision.reason ? ` · ${decision.reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {availableTransitions.length > 0 ? (
            <form
              action={updateComplianceYearStatusAction.bind(null, company.id, complianceYear.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <h2 className="text-xl font-semibold tracking-tight">Review action</h2>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Review note
                <input
                  name="reason"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {availableTransitions.map((transition) => (
                  <button
                    key={transition}
                    name="transition"
                    value={transition}
                    className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
                  >
                    {transitionLabels[transition]}
                  </button>
                ))}
              </div>
            </form>
          ) : null}

          {canReviewCompliance && complianceYear.status === "APPROVED" ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold tracking-tight">Certificate</h2>
              {complianceYear.certificate ? (
                <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <p className="font-semibold">
                    Certificate {complianceYear.certificate.certificateNumber} issued on{" "}
                    {formatDate(complianceYear.certificate.issuedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {complianceYear.certificate.generatedDocumentId ? (
                      <Link
                        href={`/registry/${company.id}/compliance/${complianceYear.id}/certificate/${complianceYear.certificate.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center rounded-md border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-900"
                      >
                        View certificate
                      </Link>
                    ) : null}
                    <form
                      action={generateComplianceCertificatePdfAction.bind(
                        null,
                        company.id,
                        complianceYear.certificate.id,
                      )}
                    >
                      <button className="min-h-9 rounded-md border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-900">
                        {complianceYear.certificate.generatedDocumentId
                          ? "Regenerate PDF"
                          : "Generate PDF"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <form
                  action={issueComplianceCertificateAction.bind(null, company.id, complianceYear.id)}
                  className="mt-4 grid gap-3"
                >
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">
                    Annual compliance certificate number
                    <select
                      name="certificateNumberId"
                      required
                      className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                    >
                      <option value="">Select available certificate number</option>
                      {availableCertificateNumbers.map((managedNumber) => (
                        <option key={managedNumber.id} value={managedNumber.id}>
                          {managedNumber.value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">
                    Issue note
                    <input
                      name="note"
                      className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                    />
                  </label>
                  <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                    Issue compliance certificate
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
