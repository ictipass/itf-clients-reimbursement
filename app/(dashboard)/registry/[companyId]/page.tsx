import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { generateRegistrationCertificatePdfAction } from "@/app/(dashboard)/registry/[companyId]/certificate/actions";
import {
  generateComplianceCertificatePdfAction,
  issueComplianceCertificateAction,
  updateComplianceYearStatusAction,
} from "@/app/(dashboard)/registry/[companyId]/compliance/actions";
import { submitTrainingPlanSubmissionAction } from "@/app/(dashboard)/registry/[companyId]/training-plans/actions";
import {
  assessRegistrationContributionAction,
  completeRegistrationAtHeadquartersAction,
  confirmRegistrationContributionAction,
  forwardRegistrationToDivisionAction,
  notifyRegistrationHeadquartersAction,
  releaseRegistrationContributionAction,
  reviewRegistrationContributionReceiptAction,
  routeRegistrationApplicationAction,
  submitRegistrationApplicationAction,
  uploadRegistrationContributionReceiptAction,
} from "@/app/(dashboard)/registry/[companyId]/registration/actions";
import { authOptions } from "@/lib/auth";
import { checkCertificateGenerationReadiness } from "@/lib/certificates";
import { listAvailableManagedNumbers } from "@/lib/managed-numbers";
import { can } from "@/lib/rbac";
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

function formatPercent(value: { toString(): string } | null) {
  if (!value) {
    return "Not scored";
  }

  return `${Number(value.toString()).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}%`;
}

const requiredCertificatePlacementFields = [
  "companyName",
  "itfEmployerNumber",
  "certificateNumber",
  "issuedAt",
  "directorGeneralSignature",
  "directorRevenueSignature",
  "qrCode",
] as const;

function getMissingCertificatePlacementFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [...requiredCertificatePlacementFields];
  }

  return requiredCertificatePlacementFields.filter((field) => !Object.hasOwn(value, field));
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

const transitionLabels = {
  submit: "Submit for review",
  start_review: "Mark in review",
  approve: "Approve",
  request_changes: "Request correction",
  reject: "Reject",
} as const;

const registrationTransitionLabels = {
  am_to_horic: "Forward to HORIC",
  horic_to_ra: "Forward to RA",
  ra_to_horic: "Return to HORIC",
  horic_to_am: "Return to AM",
  am_to_company: "Send to company",
} as const;

function getAvailableTransitions(status: string) {
  if (status === "DRAFT" || status === "CHANGES_REQUESTED") {
    return ["submit"] as const;
  }

  if (status === "SUBMITTED") {
    return ["start_review", "approve", "request_changes", "reject"] as const;
  }

  if (status === "IN_REVIEW") {
    return ["approve", "request_changes", "reject"] as const;
  }

  return [] as const;
}

function formatDesk(value: string | null | undefined) {
  if (!value) {
    return "Company";
  }

  return value.replaceAll("_", " ");
}

function getAvailableRegistrationTransitions(
  currentDesk: string,
  status: string,
  hasContributionAssessment = false,
  hasHoricReview = false,
) {
  if (status !== "SUBMITTED") {
    return [] as const;
  }

  if (currentDesk === "AREA_MANAGER") {
    if (hasHoricReview) {
      return [] as const;
    }

    return ["am_to_horic", "am_to_company"] as const;
  }

  if (currentDesk === "HORIC") {
    if (hasContributionAssessment) {
      return [] as const;
    }

    return ["horic_to_ra", "horic_to_am"] as const;
  }

  if (currentDesk === "REVENUE_ACCOUNTANT") {
    return ["ra_to_horic"] as const;
  }

  return [] as const;
}

export default async function CompanyDetailPage({
  params,
}: Readonly<{
  params: Promise<{ companyId: string }>;
}>) {
  const { companyId } = await params;
  const session = await getServerSession(authOptions);
  const company = await getEmployerCompany(companyId);

  if (!company) {
    notFound();
  }

  const registrationState = company.itfEmployerNumber
    ? "Registered with ITF"
    : "Not yet registered with ITF";
  const latestCertificate = company.registrationCertificates[0];
  const missingPlacementFields = latestCertificate?.template
    ? getMissingCertificatePlacementFields(latestCertificate.template.placementMetadata)
    : [...requiredCertificatePlacementFields];
  const localCertificateGenerationMissing = [
    latestCertificate?.template ? undefined : "certificate template",
    latestCertificate?.template?.designDocumentId ? undefined : "certificate template design",
    missingPlacementFields.length > 0
      ? `placement metadata: ${missingPlacementFields.join(", ")}`
      : undefined,
  ].filter(Boolean);
  const canGenerateCertificate = session?.user?.role
    ? can(session.user.role, "workspace:manage") || can(session.user.role, "registry:review")
    : false;
  const canGenerateComplianceCertificate = session?.user?.role
    ? can(session.user.role, "workspace:manage") || can(session.user.role, "compliance:review")
    : false;
  const certificateReadiness =
    latestCertificate && session?.user?.role && canGenerateCertificate
      ? await checkCertificateGenerationReadiness({
          certificateId: latestCertificate.id,
          requesterRole: session.user.role,
        })
      : null;
  const certificateGenerationMissing =
    certificateReadiness?.missing ?? localCertificateGenerationMissing;
  const availableItfEmployerNumbers =
    session?.user?.role &&
    company.registrationApplication?.currentDesk === "HEAD_OF_DIVISION" &&
    company.registrationApplication.status === "IN_REVIEW"
      ? await listAvailableManagedNumbers({
          requesterRole: session.user.role,
          workspaceId: company.organization.workspaceId,
          type: "ITF_EMPLOYER_NUMBER",
        })
      : [];
  const availableComplianceCertificateNumbers =
    session?.user?.role && can(session.user.role, "compliance:review")
      ? await listAvailableManagedNumbers({
          requesterRole: session.user.role,
          workspaceId: company.organization.workspaceId,
          type: "COMPLIANCE_CERTIFICATE_NUMBER",
        })
      : [];

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
        <DetailItem label="Area office" value={company.areaOffice?.name ?? "Not selected"} />
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

      {latestCertificate ? (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Registration certificate</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Current certificate record for this employer registration.
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {latestCertificate.status}
            </span>
          </div>
          <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 text-sm md:grid-cols-3">
            <DetailItem
              label="Certificate number"
              value={latestCertificate.certificateNumber}
            />
            <DetailItem
              label="ITF employer number"
              value={latestCertificate.itfEmployerNumber}
            />
            <DetailItem label="Issued by" value={latestCertificate.issuedBy.name} />
            <DetailItem label="Issued date" value={formatDate(latestCertificate.issuedAt)} />
            <DetailItem
              label="Expiry date"
              value={formatDate(latestCertificate.expiresAt)}
            />
            <DetailItem
              label="Template"
              value={
                latestCertificate.template
                  ? `${latestCertificate.template.name} v${latestCertificate.template.version}`
                  : "Not attached yet"
              }
            />
          </div>
          {latestCertificate.generatedDocumentId ? (
            <div className="mt-4 flex flex-col gap-3 rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-700 md:flex-row md:items-center md:justify-between">
              <p>
                Downloadable certificate document has been generated
                {latestCertificate.generatedAt
                  ? ` on ${formatDate(latestCertificate.generatedAt)}`
                  : ""}
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/registry/${company.id}/certificate/${latestCertificate.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800"
                >
                  View certificate
                </Link>
                {canGenerateCertificate && certificateGenerationMissing.length === 0 ? (
                  <form
                    action={generateRegistrationCertificatePdfAction.bind(
                      null,
                      company.id,
                      latestCertificate.id,
                    )}
                  >
                    <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                      Regenerate PDF
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : certificateGenerationMissing.length === 0 ? (
            <div className="mt-4 flex flex-col gap-3 rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800 md:flex-row md:items-center md:justify-between">
              <p className="font-medium">Certificate is ready for PDF generation.</p>
              {canGenerateCertificate ? (
                <form
                  action={generateRegistrationCertificatePdfAction.bind(
                    null,
                    company.id,
                    latestCertificate.id,
                  )}
                >
                  <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                    Generate PDF
                  </button>
                </form>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              PDF generation is waiting for {certificateGenerationMissing.join("; ")}.
            </p>
          )}
        </section>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Registration workflow</h2>
            {company.registrationApplication ? (
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Current desk:{" "}
                <span className="font-semibold text-zinc-900">
                  {formatDesk(company.registrationApplication.currentDesk)}
                </span>
                . Status:{" "}
                <span className="font-semibold text-zinc-900">
                  {company.registrationApplication.status.replaceAll("_", " ")}
                </span>
                .
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                This company profile has not been submitted into the Area Office registration
                workflow yet.
              </p>
            )}
          </div>
          {!company.itfEmployerNumber &&
          (!company.registrationApplication ||
            (company.registrationApplication.currentDesk === "COMPANY" &&
              company.registrationApplication.status === "CHANGES_REQUESTED")) &&
          company.areaOffice ? (
            <form action={submitRegistrationApplicationAction.bind(null, company.id)}>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                {company.registrationApplication ? "Resubmit registration" : "Submit registration"}
              </button>
            </form>
          ) : null}
        </div>
        {company.registrationApplication ? (
          <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Submitted by
              </p>
              <p className="mt-1 font-medium text-zinc-950">
                {company.registrationApplication.submittedBy?.name ?? "Not recorded"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Submitted date
              </p>
              <p className="mt-1 font-medium text-zinc-950">
                {formatDate(company.registrationApplication.submittedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Completed date
              </p>
              <p className="mt-1 font-medium text-zinc-950">
                {formatDate(company.registrationApplication.completedAt)}
              </p>
            </div>
            {company.registrationApplication.decisions[0] ? (
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Latest registration activity
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">
                  <span className="font-semibold text-zinc-950">
                    {company.registrationApplication.decisions[0].action.replaceAll("_", " ")}
                  </span>{" "}
                  by {company.registrationApplication.decisions[0].actor.name} on{" "}
                  {formatDate(company.registrationApplication.decisions[0].createdAt)}
                  {company.registrationApplication.decisions[0].reason
                    ? ` · ${company.registrationApplication.decisions[0].reason}`
                    : ""}
                </p>
              </div>
            ) : null}
            {company.registrationApplication.contributionAssessment ? (
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Contribution recommendation
                </p>
                <div className="mt-2 grid gap-2 rounded-md bg-zinc-50 p-3 md:grid-cols-3">
                  <p>
                    Recommended:{" "}
                    <span className="font-semibold text-zinc-950">
                      {formatMoney(
                        company.registrationApplication.contributionAssessment.recommendedAmount,
                      )}
                    </span>
                  </p>
                  <p>
                    By:{" "}
                    <span className="font-semibold text-zinc-950">
                      {company.registrationApplication.contributionAssessment.assessedBy.name}
                    </span>
                  </p>
                  <p>
                    Date:{" "}
                    <span className="font-semibold text-zinc-950">
                      {formatDate(
                        company.registrationApplication.contributionAssessment.assessedAt,
                      )}
                    </span>
                  </p>
                  {company.registrationApplication.contributionAssessment.assessmentNote ? (
                    <p className="md:col-span-3">
                      {company.registrationApplication.contributionAssessment.assessmentNote}
                    </p>
                  ) : null}
                  {company.registrationApplication.contributionAssessment.horicReviewedAt ? (
                    <p className="md:col-span-3">
                      HORIC confirmed by{" "}
                      <span className="font-semibold text-zinc-950">
                        {
                          company.registrationApplication.contributionAssessment.horicReviewedBy
                            ?.name
                        }
                      </span>{" "}
                      on{" "}
                      {formatDate(
                        company.registrationApplication.contributionAssessment.horicReviewedAt,
                      )}
                      {company.registrationApplication.contributionAssessment.horicReviewNote
                        ? ` · ${company.registrationApplication.contributionAssessment.horicReviewNote}`
                        : ""}
                    </p>
                  ) : null}
                  {company.registrationApplication.contributionAssessment.amReleasedAt ? (
                    <p className="md:col-span-3">
                      Released to company by{" "}
                      <span className="font-semibold text-zinc-950">
                        {
                          company.registrationApplication.contributionAssessment.amReleasedBy
                            ?.name
                        }
                      </span>{" "}
                      on{" "}
                      {formatDate(
                        company.registrationApplication.contributionAssessment.amReleasedAt,
                      )}
                      {company.registrationApplication.contributionAssessment.amReleaseNote
                        ? ` · ${company.registrationApplication.contributionAssessment.amReleaseNote}`
                        : ""}
                      {company.registrationApplication.contributionAssessment.releaseChannel
                        ? ` · ${company.registrationApplication.contributionAssessment.releaseChannel.replaceAll("_", " ")}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {company.registrationApplication.contributionAssessment?.amReleasedAt ? (
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Payment receipt
                </p>
                {company.registrationApplication.documents.length === 0 ? (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No contribution payment receipt has been uploaded yet.
                  </p>
                ) : (
                  <div className="mt-2 grid gap-2 rounded-md bg-zinc-50 p-3">
                    {company.registrationApplication.documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <p>
                          <span className="font-semibold text-zinc-950">{document.fileName}</span>{" "}
                          · {formatDate(document.createdAt)}
                        </p>
                        <Link
                          href={`/registry/${company.id}/evidence/${document.id}?disposition=inline`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800"
                        >
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {company.registrationApplication.currentDesk === "DIRECTOR_FSD" &&
            company.registrationApplication.status === "IN_REVIEW" ? (
              <div className="md:col-span-3">
                <p className="rounded-md bg-[#800020]/10 px-3 py-2 text-sm font-semibold text-[#65001a]">
                  Headquarters notification is pending with Director FSD.
                </p>
              </div>
            ) : null}
            {company.registrationApplication.currentDesk === "HEAD_OF_DIVISION" &&
            company.registrationApplication.status === "IN_REVIEW" ? (
              <div className="md:col-span-3">
                <p className="rounded-md bg-[#800020]/10 px-3 py-2 text-sm font-semibold text-[#65001a]">
                  Employer registration completion is pending with Head of Reimbursement Division.
                </p>
              </div>
            ) : null}
          </div>
        ) : company.itfEmployerNumber ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            This employer is already registered with ITF. Subsequent yearly obligations should be
            handled through annual compliance, training plan submission, training approval, and
            claims workflows.
          </p>
        ) : !company.areaOffice ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Select an Area Office before registration can be submitted.
          </p>
        ) : null}
        {!company.itfEmployerNumber &&
        company.registrationApplication &&
        getAvailableRegistrationTransitions(
          company.registrationApplication.currentDesk,
          company.registrationApplication.status,
          Boolean(company.registrationApplication.contributionAssessment),
          Boolean(company.registrationApplication.contributionAssessment?.horicReviewedAt),
        ).length > 0 ? (
          <form
            action={routeRegistrationApplicationAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Routing note
              <input
                name="reason"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {getAvailableRegistrationTransitions(
                company.registrationApplication.currentDesk,
                company.registrationApplication.status,
                Boolean(company.registrationApplication.contributionAssessment),
                Boolean(company.registrationApplication.contributionAssessment?.horicReviewedAt),
              ).map((transition) => (
                <button
                  key={transition}
                  name="transition"
                  value={transition}
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
                >
                  {registrationTransitionLabels[transition]}
                </button>
              ))}
            </div>
          </form>
        ) : null}
        {company.registrationApplication?.currentDesk === "HORIC" &&
        company.registrationApplication.status === "SUBMITTED" &&
        company.registrationApplication.contributionAssessment &&
        !company.registrationApplication.contributionAssessment.horicReviewedAt ? (
          <form
            action={confirmRegistrationContributionAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              HORIC review note
              <input
                name="reviewNote"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Confirm recommendation and send to AM
              </button>
            </div>
          </form>
        ) : null}
        {company.registrationApplication?.currentDesk === "AREA_MANAGER" &&
        company.registrationApplication.status === "SUBMITTED" &&
        company.registrationApplication.contributionAssessment?.horicReviewedAt &&
        !company.registrationApplication.contributionAssessment.amReleasedAt ? (
          <form
            action={releaseRegistrationContributionAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              AM release note
              <input
                name="releaseNote"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                name="releaseChannel"
                required
                defaultValue="DASHBOARD"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
              >
                <option value="DASHBOARD">Dashboard only</option>
                <option value="DASHBOARD_AND_EMAIL">Dashboard and email</option>
              </select>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Release recommendation to company
              </button>
            </div>
          </form>
        ) : null}
        {company.registrationApplication?.currentDesk === "AREA_MANAGER" &&
        company.registrationApplication.status === "SUBMITTED" &&
        company.registrationApplication.contributionAssessment?.amReleasedAt &&
        company.registrationApplication.documents.length > 0 ? (
          <form
            action={reviewRegistrationContributionReceiptAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Receipt review note
              <input
                name="reviewNote"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                name="action"
                value="accept"
                className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
              >
                Accept receipt
              </button>
              <button
                name="action"
                value="request_changes"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900"
              >
                Request correction
              </button>
            </div>
          </form>
        ) : null}
        {company.registrationApplication?.currentDesk === "AREA_MANAGER" &&
        company.registrationApplication.status === "IN_REVIEW" &&
        company.registrationApplication.contributionAssessment?.amReleasedAt &&
        company.registrationApplication.documents.length > 0 ? (
          <form
            action={notifyRegistrationHeadquartersAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Headquarters notification note
              <input
                name="note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Notify Headquarters
              </button>
            </div>
          </form>
        ) : null}
        {!company.itfEmployerNumber &&
        company.registrationApplication?.currentDesk === "DIRECTOR_FSD" &&
        company.registrationApplication.status === "IN_REVIEW" ? (
          <form
            action={forwardRegistrationToDivisionAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Director forwarding note
              <input
                name="note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Forward to Head of Division
              </button>
            </div>
          </form>
        ) : null}
        {!company.itfEmployerNumber &&
        company.registrationApplication?.currentDesk === "HEAD_OF_DIVISION" &&
        company.registrationApplication.status === "IN_REVIEW" ? (
          <form
            action={completeRegistrationAtHeadquartersAction.bind(null, company.id)}
            className="mt-4 grid gap-4 border-t border-zinc-100 pt-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                ITF employer number
                <select
                  name="itfEmployerNumberId"
                  required
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                >
                  <option value="">Select available ITF employer number</option>
                  {availableItfEmployerNumbers.map((managedNumber) => (
                    <option key={managedNumber.id} value={managedNumber.id}>
                      {managedNumber.value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {availableItfEmployerNumbers.length === 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Add available ITF employer numbers in Settings before completing this registration.
              </p>
            ) : null}
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Head of Division completion note
              <input
                name="note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Complete employer registration
              </button>
            </div>
          </form>
        ) : null}
        {company.registrationApplication?.currentDesk === "REVENUE_ACCOUNTANT" &&
        company.registrationApplication.status === "SUBMITTED" ? (
          <form
            action={assessRegistrationContributionAction.bind(null, company.id)}
            className="mt-4 grid gap-4 border-t border-zinc-100 pt-4"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Payroll basis
                <input
                  name="payrollBasis"
                  inputMode="decimal"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Turnover basis
                <input
                  name="turnoverBasis"
                  inputMode="decimal"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Recommended contribution
                <input
                  name="recommendedAmount"
                  inputMode="decimal"
                  required
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Assessment note
              <textarea
                name="assessmentNote"
                rows={3}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Recommend contribution and return to HORIC
              </button>
            </div>
          </form>
        ) : null}
        {company.registrationApplication?.currentDesk === "COMPANY" &&
        company.registrationApplication.status === "SUBMITTED" &&
        company.registrationApplication.contributionAssessment?.amReleasedAt ? (
          <form
            action={uploadRegistrationContributionReceiptAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Contribution payment receipt
              <input
                name="receipt"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Upload payment receipt
              </button>
            </div>
          </form>
        ) : null}
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
                    href={`/registry/${company.id}/evidence/${document.id}?disposition=inline`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                  >
                    View
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
                  className="rounded-md border border-zinc-100 p-3 text-sm"
                >
                  <div className="grid gap-2 md:grid-cols-3">
                    <p className="font-semibold">{complianceYear.year}</p>
                    <p>{complianceYear.status.replaceAll("_", " ")}</p>
                    <p>{formatMoney(complianceYear.amountPaid)}</p>
                  </div>
                  {complianceYear.certificate ? (
                    <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <p className="font-semibold">
                        Compliance certificate {complianceYear.certificate.certificateNumber} issued
                        on {formatDate(complianceYear.certificate.issuedAt)}
                      </p>
                      {complianceYear.certificate.generatedDocumentId ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/registry/${company.id}/compliance/${complianceYear.id}/certificate/${complianceYear.certificate.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center rounded-md border border-emerald-200 bg-white px-2 font-semibold text-emerald-900"
                          >
                            View certificate
                          </Link>
                          {canGenerateComplianceCertificate ? (
                            <form
                              action={generateComplianceCertificatePdfAction.bind(
                                null,
                                company.id,
                                complianceYear.certificate.id,
                              )}
                            >
                              <button className="min-h-8 rounded-md border border-emerald-200 bg-white px-2 font-semibold text-emerald-900">
                                Regenerate PDF
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            Certificate PDF is pending generation.
                          </p>
                          {canGenerateComplianceCertificate ? (
                            <form
                              action={generateComplianceCertificatePdfAction.bind(
                                null,
                                company.id,
                                complianceYear.certificate.id,
                              )}
                            >
                              <button className="min-h-8 rounded-md border border-emerald-200 bg-white px-2 font-semibold text-emerald-900">
                                Generate PDF
                              </button>
                            </form>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                  {complianceYear.decisions[0] ? (
                    <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
                      Last decision:{" "}
                      <span className="font-semibold text-zinc-800">
                        {complianceYear.decisions[0].action.replaceAll("_", " ")}
                      </span>{" "}
                      by {complianceYear.decisions[0].actor.name} on{" "}
                      {formatDate(complianceYear.decisions[0].createdAt)}
                      {complianceYear.decisions[0].reason
                        ? ` · ${complianceYear.decisions[0].reason}`
                        : ""}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <p className="text-xs text-zinc-500">
                      {complianceYear.documents.length === 0
                        ? "No compliance evidence uploaded"
                        : `${complianceYear.documents.length} evidence document${complianceYear.documents.length === 1 ? "" : "s"}`}
                    </p>
                    <Link
                      href={`/registry/${company.id}/compliance/${complianceYear.id}/evidence/new`}
                      className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                    >
                      Upload evidence
                    </Link>
                  </div>
                  {getAvailableTransitions(complianceYear.status).length > 0 ? (
                    <form
                      action={updateComplianceYearStatusAction.bind(
                        null,
                        company.id,
                        complianceYear.id,
                      )}
                      className="mt-3 grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3"
                    >
                      <label className="grid gap-2 text-xs font-medium text-zinc-700">
                        Review note
                        <input
                          name="reason"
                          className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {getAvailableTransitions(complianceYear.status).map((transition) => (
                          <button
                            key={transition}
                            name="transition"
                            value={transition}
                            className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900"
                          >
                            {transitionLabels[transition]}
                          </button>
                        ))}
                      </div>
                    </form>
                  ) : null}
                  {complianceYear.status === "APPROVED" && !complianceYear.certificate ? (
                    <form
                      action={issueComplianceCertificateAction.bind(
                        null,
                        company.id,
                        complianceYear.id,
                      )}
                      className="mt-3 grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3"
                    >
                      <label className="grid gap-2 text-xs font-medium text-zinc-700">
                        Annual compliance certificate number
                        <select
                          name="certificateNumberId"
                          required
                          className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                        >
                          <option value="">Select available certificate number</option>
                          {availableComplianceCertificateNumbers.map((managedNumber) => (
                            <option key={managedNumber.id} value={managedNumber.id}>
                              {managedNumber.value}
                            </option>
                          ))}
                        </select>
                      </label>
                      {availableComplianceCertificateNumbers.length === 0 ? (
                        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          Add available compliance certificate numbers in Settings before issuing
                          the annual certificate.
                        </p>
                      ) : null}
                      <label className="grid gap-2 text-xs font-medium text-zinc-700">
                        Issue note
                        <input
                          name="note"
                          className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                        />
                      </label>
                      <button className="min-h-9 w-fit rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                        Issue compliance certificate
                      </button>
                    </form>
                  ) : null}
                  {complianceYear.documents.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {complianceYear.documents.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-zinc-600"
                        >
                          <p>
                            <span className="font-semibold text-zinc-800">
                              {document.fileName}
                            </span>{" "}
                            · {document.kind.replaceAll("_", " ")}
                          </p>
                          <Link
                            href={`/registry/${company.id}/evidence/${document.id}?disposition=inline`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-2 font-semibold text-zinc-800"
                          >
                            View
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Training Plan and L&amp;D submissions
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Yearly Form 3A personnel details, annual training plan evidence, and L&amp;D
              personnel CV records.
            </p>
          </div>
          <Link
            href={`/registry/${company.id}/training-plans/new`}
            className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
          >
            Create submission
          </Link>
        </div>

        {company.trainingPlanSubmissions.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            No Training Plan and L&amp;D submission has been created for this company yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {company.trainingPlanSubmissions.map((submission) => {
              const submittedDocumentKinds = new Set(
                submission.documents.map((document) => document.kind),
              );
              const missingRequiredEvidence = [
                submittedDocumentKinds.has("TRAINING_PLAN_DOCUMENT")
                  ? undefined
                  : "training plan document",
                submittedDocumentKinds.has("LD_PERSONNEL_CV") ? undefined : "L&D personnel CV",
              ].filter(Boolean);

              return (
                <div key={submission.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-4">
                    <p className="font-semibold">{submission.year}</p>
                    <p>{submission.status.replaceAll("_", " ")}</p>
                    <p>Due {formatDate(submission.dueDate)}</p>
                    <p>Prompt score: {formatPercent(submission.promptSubmissionScore)}</p>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600 md:grid-cols-2">
                    <p>
                      L&amp;D personnel count:{" "}
                      <span className="font-semibold text-zinc-800">
                        {submission.personnel.length}
                      </span>
                    </p>
                    <p>Submitted: {formatDate(submission.submittedAt)}</p>
                    {submission.decisions[0] ? (
                      <p>
                        Last decision:{" "}
                        <span className="font-semibold text-zinc-800">
                          {submission.decisions[0].action.replaceAll("_", " ")}
                        </span>{" "}
                        by {submission.decisions[0].actor.name} on{" "}
                        {formatDate(submission.decisions[0].createdAt)}
                      </p>
                    ) : null}
                  </div>
                  {submission.personnel.length > 0 ? (
                    <div className="mt-3 grid gap-2 rounded-md border border-zinc-100 p-3 text-xs leading-5 text-zinc-600 md:grid-cols-2">
                      {submission.personnel.map((person) => (
                        <p key={person.id}>
                          <span className="font-semibold text-zinc-800">{person.name}</span>
                          {person.position ? ` · ${person.position}` : ""}
                          {person.email ? ` · ${person.email}` : ""}
                          {person.phone ? ` · ${person.phone}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {missingRequiredEvidence.length > 0 ? (
                    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Required before submission: {missingRequiredEvidence.join(", ")}.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <p className="text-xs text-zinc-500">
                      {submission.documents.length === 0
                        ? "No Training Plan evidence uploaded"
                        : `${submission.documents.length} evidence document${submission.documents.length === 1 ? "" : "s"}`}
                    </p>
                    <Link
                      href={`/registry/${company.id}/training-plans/${submission.id}/evidence/new`}
                      className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                    >
                      Upload evidence
                    </Link>
                  </div>
                  {submission.status === "DRAFT" && missingRequiredEvidence.length === 0 ? (
                    <form
                      action={submitTrainingPlanSubmissionAction.bind(
                        null,
                        company.id,
                        submission.id,
                      )}
                      className="mt-3 grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3"
                    >
                      <label className="grid gap-2 text-xs font-medium text-zinc-700">
                        Submission note
                        <input
                          name="note"
                          className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                        />
                      </label>
                      <button className="min-h-9 w-fit rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                        Submit Training Plan package
                      </button>
                    </form>
                  ) : null}
                  {submission.documents.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {submission.documents.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-zinc-600"
                        >
                          <p>
                            <span className="font-semibold text-zinc-800">
                              {document.fileName}
                            </span>{" "}
                            · {document.kind.replaceAll("_", " ")}
                          </p>
                          <Link
                            href={`/registry/${company.id}/evidence/${document.id}?disposition=inline`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 px-2 font-semibold text-zinc-800"
                          >
                            View
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
