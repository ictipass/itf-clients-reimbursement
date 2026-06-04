import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { deleteCompanyEvidenceAction } from "@/app/(dashboard)/registry/[companyId]/evidence/actions";
import {
  generateComplianceCertificatePdfAction,
  issueComplianceCertificateAction,
  updateComplianceYearStatusAction,
} from "@/app/(dashboard)/registry/[companyId]/compliance/actions";
import {
  routeTrainingPlanSubmissionAction,
  submitTrainingPlanSubmissionAction,
} from "@/app/(dashboard)/registry/[companyId]/training-plans/actions";
import {
  assessRegistrationContributionAction,
  completeRegistrationAtHeadquartersAction,
  confirmRegistrationContributionAction,
  forwardRegistrationToDivisionAction,
  notifyRegistrationHeadquartersAction,
  recordLegacyRegistrationAction,
  releaseRegistrationContributionAction,
  reviewLegacyRegistrationClaimAction,
  reviewRegistrationContributionReceiptAction,
  routeRegistrationApplicationAction,
  submitRegistrationApplicationAction,
  uploadRegistrationContributionReceiptAction,
} from "@/app/(dashboard)/registry/[companyId]/registration/actions";
import { RegistrationSubmissionFields } from "@/app/(dashboard)/registry/[companyId]/registration/RegistrationSubmissionFields";
import { authOptions } from "@/lib/auth";
import { listAvailableManagedNumbers } from "@/lib/managed-numbers";
import { can, canManageAnnualCompliance, type Role } from "@/lib/rbac";
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

function readPositiveInteger(value: string | string[] | undefined, fallback = 1) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function buildCompanyPageHref(
  companyId: string,
  searchParams: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();

  return queryString ? `/registry/${companyId}?${queryString}` : `/registry/${companyId}`;
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

function ActionGroup({
  title,
  description,
  isAdminOverride,
  children,
}: Readonly<{
  title: string;
  description: string;
  isAdminOverride: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
        </div>
        {isAdminOverride ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            Admin/testing override
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function EvidenceActions({
  companyId,
  documentId,
  canDelete,
}: Readonly<{
  companyId: string;
  documentId: string;
  canDelete: boolean;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/registry/${companyId}/evidence/${documentId}?disposition=inline`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800"
      >
        View
      </Link>
      {canDelete ? (
        <form action={deleteCompanyEvidenceAction.bind(null, companyId, documentId)}>
          <button className="inline-flex min-h-8 items-center rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700">
            Delete
          </button>
        </form>
      ) : null}
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
  ra_to_company: "Request employer correction",
  horic_to_am: "Return to AM",
  am_to_company: "Send to company",
} as const;

const trainingPlanTransitionLabels = {
  am_to_hot: "Forward to HOT",
  hot_to_ro: "Forward to Reimbursement Officer",
  ro_to_hot: "Return to HOT",
  hot_to_am: "Return to AM",
  am_to_company: "Request employer correction",
  am_approve: "Approve package",
} as const;

function getRoleAvailableComplianceTransitions(
  status: string,
  role: Role,
  adminOverride: boolean,
) {
  return getAvailableTransitions(status).filter((transition) => {
    if (transition === "submit") {
      return isEmployerRole(role) || adminOverride;
    }

    return canManageAnnualCompliance(role);
  });
}

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

function formatRegistrationKind(value: string | null | undefined) {
  if (value === "LEGACY_EMPLOYER") {
    return "Already registered with ITF";
  }

  return "New employer registration";
}

function getRegistryRoleFocus(role: Role) {
  if (isEmployerRole(role)) {
    return {
      title: "Employer workspace",
      detail:
        "Complete company evidence, submit registration, file annual compliance, and manage Training Plan submissions assigned back to the company.",
    };
  }

  if (role === "AREA_MANAGER") {
    return {
      title: "Area Manager desk",
      detail:
        "Review Area Office registration routing, receipt acceptance, employer corrections, and compliance filings for awareness.",
    };
  }

  if (role === "HORIC") {
    return {
      title: "HORIC desk",
      detail:
        "Examine Area Office registration submissions and confirm Revenue Accountant recommendations before they return to the Area Manager.",
    };
  }

  if (role === "REVENUE_ACCOUNTANT") {
    return {
      title: "Revenue Accountant desk",
      detail:
        "Assess registration contribution recommendations and validate legacy employer registration claims for companies in your Area Office.",
    };
  }

  if (role === "HEAD_OF_DIVISION" || role === "HQ_REVENUE_ACCOUNTANT") {
    return {
      title: "Headquarters compliance desk",
      detail:
        "Review annual compliance returns, manage compliance certificate numbers, and issue certificates after HQ approval.",
    };
  }

  if (role === "DIRECTOR_FSD") {
    return {
      title: "Director FSD desk",
      detail:
        "Receive headquarters registration notifications and forward registration packages to the reimbursement division.",
    };
  }

  if (role === "HEAD_OF_TRAINING" || role === "REIMBURSEMENT_OFFICER") {
    return {
      title: "Training workflow desk",
      detail:
        "Review Training Plan and L&D submissions routed through the Area Office training workflow.",
    };
  }

  if (isAdminRole(role)) {
    return {
      title: "Administration and testing view",
      detail:
        "You can see broad workflow controls for setup, support, and testing. Production users see a narrower role-focused view.",
    };
  }

  return {
    title: "Read-only workflow view",
    detail: "Review company registration, compliance, evidence, and Training Plan history.",
  };
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
    return ["ra_to_horic", "ra_to_company"] as const;
  }

  return [] as const;
}

function isAdminRole(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}

function isEmployerRole(role: Role) {
  return role === "EMPLOYER_ADMIN" || role === "EMPLOYER_SUBMITTER";
}

function canActAsDesk(role: Role, desk: string | null | undefined) {
  if (isAdminRole(role)) {
    return true;
  }

  if (desk === "COMPANY") {
    return isEmployerRole(role);
  }

  if (desk === "AREA_MANAGER") {
    return role === "AREA_MANAGER";
  }

  if (desk === "HORIC") {
    return role === "HORIC";
  }

  if (desk === "REVENUE_ACCOUNTANT") {
    return role === "REVENUE_ACCOUNTANT";
  }

  if (desk === "DIRECTOR_FSD") {
    return role === "DIRECTOR_FSD";
  }

  if (desk === "HEAD_OF_DIVISION") {
    return role === "HEAD_OF_DIVISION";
  }

  return false;
}

function canActAsTrainingPlanDesk(role: Role, desk: string | null | undefined) {
  if (isAdminRole(role)) {
    return true;
  }

  if (desk === "COMPANY") {
    return isEmployerRole(role);
  }

  if (desk === "AREA_MANAGER") {
    return role === "AREA_MANAGER";
  }

  if (desk === "HEAD_OF_TRAINING") {
    return role === "HEAD_OF_TRAINING";
  }

  if (desk === "REIMBURSEMENT_OFFICER") {
    return role === "REIMBURSEMENT_OFFICER";
  }

  return false;
}

function canRecordLegacyRegistrationRole(role: Role) {
  return (
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    role === "DIRECTOR_FSD" ||
    role === "HEAD_OF_DIVISION" ||
    role === "REVENUE_ACCOUNTANT"
  );
}

function canReviewLegacyRegistrationClaimRole(role: Role) {
  return canRecordLegacyRegistrationRole(role);
}

function getAvailableTrainingPlanTransitions(currentDesk: string, status: string) {
  if (status !== "SUBMITTED" && status !== "IN_REVIEW") {
    return [] as const;
  }

  if (currentDesk === "AREA_MANAGER") {
    if (status === "IN_REVIEW") {
      return ["am_approve", "am_to_company"] as const;
    }

    return ["am_to_hot", "am_to_company"] as const;
  }

  if (currentDesk === "HEAD_OF_TRAINING") {
    return ["hot_to_ro", "hot_to_am"] as const;
  }

  if (currentDesk === "REIMBURSEMENT_OFFICER") {
    return ["ro_to_hot"] as const;
  }

  return [] as const;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    compliancePage?: string | string[];
    evidencePage?: string | string[];
  }>;
}>) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const company = await getEmployerCompany(companyId);

  if (!company) {
    notFound();
  }

  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const roleFocus = getRegistryRoleFocus(activeRole);
  const adminOverride = isAdminRole(activeRole);
  const canDeleteEvidence =
    adminOverride ||
    isEmployerRole(activeRole) ||
    can(activeRole, "registry:review") ||
    can(activeRole, "compliance:review") ||
    can(activeRole, "training:approve");
  const currentYear = new Date().getFullYear();
  const evidenceDocumentsPerPage = 5;
  const evidenceTotalPages = Math.ceil(company.documents.length / evidenceDocumentsPerPage);
  const evidencePage = clampPage(readPositiveInteger(query.evidencePage), evidenceTotalPages);
  const visibleCompanyDocuments = company.documents.slice(
    (evidencePage - 1) * evidenceDocumentsPerPage,
    evidencePage * evidenceDocumentsPerPage,
  );
  const complianceYearsPerPage = 5;
  const complianceYearTotalPages = Math.ceil(
    company.complianceYears.length / complianceYearsPerPage,
  );
  const compliancePage = clampPage(
    readPositiveInteger(query.compliancePage),
    complianceYearTotalPages,
  );
  const visibleComplianceYears = company.complianceYears.slice(
    (compliancePage - 1) * complianceYearsPerPage,
    compliancePage * complianceYearsPerPage,
  );
  const certifiedComplianceYears = new Set(
    company.complianceYears
      .filter((complianceYear) => complianceYear.status === "APPROVED" && complianceYear.certificate)
      .map((complianceYear) => complianceYear.year),
  );
  const hasCurrentYearCertifiedCompliance = certifiedComplianceYears.has(currentYear);
  const registrationState = company.itfEmployerNumber
    ? "Registered with ITF"
    : "Not yet registered with ITF";
  const canManageComplianceCertificate = canManageAnnualCompliance(activeRole);
  const availableItfEmployerNumbers =
    company.registrationApplication?.currentDesk === "HEAD_OF_DIVISION" &&
    company.registrationApplication.status === "IN_REVIEW"
      ? await listAvailableManagedNumbers({
          requesterRole: activeRole,
          workspaceId: company.organization.workspaceId,
          type: "ITF_EMPLOYER_NUMBER",
        })
      : [];
  const availableComplianceCertificateNumbers =
    canManageComplianceCertificate
      ? await listAvailableManagedNumbers({
          requesterRole: activeRole,
          workspaceId: company.organization.workspaceId,
          type: "COMPLIANCE_CERTIFICATE_NUMBER",
        })
      : [];
  const registrationApplication = company.registrationApplication;
  const availableRegistrationTransitions = registrationApplication
    ? getAvailableRegistrationTransitions(
        registrationApplication.currentDesk,
        registrationApplication.status,
        Boolean(registrationApplication.contributionAssessment),
        Boolean(registrationApplication.contributionAssessment?.horicReviewedAt),
      )
    : [];
  const canSubmitRegistration =
    !company.itfEmployerNumber &&
    (!registrationApplication ||
      (registrationApplication.currentDesk === "COMPANY" &&
        registrationApplication.status === "CHANGES_REQUESTED")) &&
    Boolean(company.areaOffice) &&
    (isEmployerRole(activeRole) || adminOverride);
  const canRouteRegistration =
    !company.itfEmployerNumber &&
    Boolean(registrationApplication) &&
    availableRegistrationTransitions.length > 0 &&
    canActAsDesk(activeRole, registrationApplication?.currentDesk) &&
    !(
      registrationApplication?.registrationKind === "LEGACY_EMPLOYER" &&
      registrationApplication.currentDesk === "REVENUE_ACCOUNTANT"
    );
  const canConfirmContribution =
    registrationApplication?.currentDesk === "HORIC" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment) &&
    !registrationApplication.contributionAssessment?.horicReviewedAt &&
    canActAsDesk(activeRole, "HORIC");
  const canReleaseContribution =
    registrationApplication?.currentDesk === "AREA_MANAGER" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment?.horicReviewedAt) &&
    !registrationApplication.contributionAssessment?.amReleasedAt &&
    canActAsDesk(activeRole, "AREA_MANAGER");
  const canReviewReceipt =
    registrationApplication?.currentDesk === "AREA_MANAGER" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment?.amReleasedAt) &&
    registrationApplication.documents.length > 0 &&
    canActAsDesk(activeRole, "AREA_MANAGER");
  const canNotifyHeadquarters =
    registrationApplication?.currentDesk === "AREA_MANAGER" &&
    registrationApplication.status === "IN_REVIEW" &&
    Boolean(registrationApplication.contributionAssessment?.amReleasedAt) &&
    registrationApplication.documents.length > 0 &&
    canActAsDesk(activeRole, "AREA_MANAGER");
  const canAssessContribution =
    registrationApplication?.currentDesk === "REVENUE_ACCOUNTANT" &&
    registrationApplication.status === "SUBMITTED" &&
    registrationApplication.registrationKind !== "LEGACY_EMPLOYER" &&
    canActAsDesk(activeRole, "REVENUE_ACCOUNTANT");
  const canReviewLegacyRegistrationClaim =
    !company.itfEmployerNumber &&
    registrationApplication?.registrationKind === "LEGACY_EMPLOYER" &&
    registrationApplication.currentDesk === "REVENUE_ACCOUNTANT" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.claimedItfEmployerNumber) &&
    canReviewLegacyRegistrationClaimRole(activeRole);
  const canUploadReceipt =
    registrationApplication?.currentDesk === "COMPANY" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment?.amReleasedAt) &&
    (isEmployerRole(activeRole) || adminOverride);
  const canForwardToDivision =
    !company.itfEmployerNumber &&
    registrationApplication?.currentDesk === "DIRECTOR_FSD" &&
    registrationApplication.status === "IN_REVIEW" &&
    canActAsDesk(activeRole, "DIRECTOR_FSD");
  const canCompleteAtHeadquarters =
    !company.itfEmployerNumber &&
    registrationApplication?.currentDesk === "HEAD_OF_DIVISION" &&
    registrationApplication.status === "IN_REVIEW" &&
    canActAsDesk(activeRole, "HEAD_OF_DIVISION");
  const canRecordLegacyRegistration =
    !company.itfEmployerNumber &&
    canRecordLegacyRegistrationRole(activeRole) &&
    (!registrationApplication ||
      registrationApplication.status === "DRAFT" ||
      registrationApplication.status === "CHANGES_REQUESTED");
  const canCreateComplianceYear = Boolean(company.itfEmployerNumber);
  const hasVisibleRegistrationActions =
    canSubmitRegistration ||
    canRouteRegistration ||
    canConfirmContribution ||
    canReleaseContribution ||
    canReviewReceipt ||
    canNotifyHeadquarters ||
    canAssessContribution ||
    canReviewLegacyRegistrationClaim ||
    canUploadReceipt ||
    canForwardToDivision ||
    canCompleteAtHeadquarters ||
    canRecordLegacyRegistration;
  const newCompanySteps = [
    {
      title: "Company profile",
      status: "Done",
      isDone: true,
      detail: "Employer record created.",
    },
    {
      title: "Area Office",
      status: company.areaOffice ? "Done" : "Pending",
      isDone: Boolean(company.areaOffice),
      detail: company.areaOffice ? company.areaOffice.name : "Select preferred Area Office.",
    },
    {
      title: "Evidence",
      status: company.documents.length > 0 ? "Done" : "Pending",
      isDone: company.documents.length > 0,
      detail:
        company.documents.length > 0
          ? `${company.documents.length} document${company.documents.length === 1 ? "" : "s"} uploaded.`
          : "Upload registration evidence.",
    },
    {
      title: "Registration",
      status: company.itfEmployerNumber ? "Done" : "Pending",
      isDone: Boolean(company.itfEmployerNumber),
      detail: company.itfEmployerNumber
        ? `ITF number ${company.itfEmployerNumber}`
        : "Submit registration for ITF review.",
    },
    {
      title: "Compliance year",
      status: company.complianceYears.length > 0 ? "Started" : "Locked",
      isDone: company.complianceYears.length > 0,
      detail: company.itfEmployerNumber
        ? "Create or complete annual compliance."
        : "Available after registration completion.",
    },
  ];
  const currentComplianceYear = company.complianceYears.find(
    (complianceYear) => complianceYear.year === currentYear,
  );
  const registeredCompanySteps = [
    {
      title: "Registered",
      status: "Done",
      isDone: true,
      detail: `ITF number ${company.itfEmployerNumber}`,
    },
    {
      title: `${currentYear} compliance`,
      status: currentComplianceYear ? "Started" : "Pending",
      isDone: Boolean(currentComplianceYear),
      detail: currentComplianceYear
        ? `${currentYear} is ${currentComplianceYear.status.replaceAll("_", " ")}.`
        : `Create the ${currentYear} annual compliance year.`,
    },
    {
      title: "Payment evidence",
      status: currentComplianceYear?.documents.length ? "Started" : "Pending",
      isDone: Boolean(currentComplianceYear?.documents.length),
      detail: currentComplianceYear?.documents.length
        ? `${currentComplianceYear.documents.length} document${currentComplianceYear.documents.length === 1 ? "" : "s"} uploaded for ${currentYear}.`
        : `Upload ${currentYear} payment and compliance evidence.`,
    },
    {
      title: "Certificate",
      status: hasCurrentYearCertifiedCompliance ? "Done" : "Pending",
      isDone: hasCurrentYearCertifiedCompliance,
      detail: hasCurrentYearCertifiedCompliance
        ? `${currentYear} compliance certificate issued.`
        : "Issued after compliance approval.",
    },
  ];

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

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Your view
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{roleFocus.title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
              {roleFocus.detail}
            </p>
          </div>
          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {activeRole.replaceAll("_", " ")}
          </span>
        </div>
      </section>

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

      {!company.itfEmployerNumber ? (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                New employer registration path
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Complete these steps in order before annual compliance filing becomes available.
              </p>
            </div>
            <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              New company
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {newCompanySteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    {index + 1}
                  </span>
                  <span
                    className={
                      step.isDone
                        ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                    }
                  >
                    {step.status}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-zinc-950">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Registered company annual compliance path
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                This company already has an ITF employer number, so registration is not repeated.
                Continue with annual compliance for each year.
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Registered
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {registeredCompanySteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    {index + 1}
                  </span>
                  <span
                    className={
                      step.isDone
                        ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                    }
                  >
                    {step.status}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-zinc-950">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

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
                workflow yet until relevant documents are provided and at least one compliance year created.
              </p>
            )}
          </div>
        </div>
        {company.registrationApplication ? (
          <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Registration type
              </p>
              <p className="mt-1 font-medium text-zinc-950">
                {formatRegistrationKind(company.registrationApplication.registrationKind)}
              </p>
            </div>
            {company.registrationApplication.claimedItfEmployerNumber ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Claimed ITF number
                </p>
                <p className="mt-1 font-medium text-zinc-950">
                  {company.registrationApplication.claimedItfEmployerNumber}
                </p>
              </div>
            ) : null}
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
                        <EvidenceActions
                          companyId={company.id}
                          documentId={document.id}
                          canDelete={canDeleteEvidence}
                        />
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
        {!hasVisibleRegistrationActions && company.registrationApplication ? (
          <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No registration action is currently assigned to your role. Current desk is{" "}
            <span className="font-semibold text-zinc-900">
              {formatDesk(company.registrationApplication.currentDesk)}
            </span>
            .
          </p>
        ) : null}
        {canRecordLegacyRegistration ? (
          <ActionGroup
            title="Legacy registration action"
            description="Record an existing ITF employer number for a company that registered before the portal, then open the current annual compliance filing."
            isAdminOverride={adminOverride}
          >
            <form
              action={recordLegacyRegistrationAction.bind(null, company.id)}
              className="grid gap-4"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Existing ITF employer number
                  <input
                    name="itfEmployerNumber"
                    required
                    className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Onboarding note
                <textarea
                  name="note"
                  rows={3}
                  required
                  placeholder="Record the source or reason for treating this company as already registered."
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2"
                />
              </label>
              <div>
                <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Record existing ITF number
                </button>
              </div>
            </form>
          </ActionGroup>
        ) : null}
        {canRouteRegistration && company.registrationApplication ? (
          <ActionGroup
            title="Area Office routing"
            description="Move this registration to the next desk in the Area Office review chain."
            isAdminOverride={adminOverride}
          >
          <form action={routeRegistrationApplicationAction.bind(null, company.id)} className="grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Routing note
              <input
                name="reason"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {availableRegistrationTransitions.map((transition) => (
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
          </ActionGroup>
        ) : null}
        {canReviewLegacyRegistrationClaim ? (
          <ActionGroup
            title="Legacy employer validation"
            description="Validate, reject, or return the claimed existing ITF registration number to the employer for correction."
            isAdminOverride={adminOverride}
          >
            <form
              action={reviewLegacyRegistrationClaimAction.bind(null, company.id)}
              className="grid gap-3"
            >
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Claimed ITF number:{" "}
                <span className="font-semibold text-zinc-950">
                  {company.registrationApplication?.claimedItfEmployerNumber}
                </span>
              </div>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Review note
                <textarea
                  name="note"
                  rows={3}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  name="action"
                  value="validate"
                  className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
                >
                  Validate legacy registration
                </button>
                <button
                  name="action"
                  value="request_changes"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900"
                >
                  Request correction
                </button>
                <button
                  name="action"
                  value="reject"
                  className="min-h-10 rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700"
                >
                  Reject claim
                </button>
              </div>
            </form>
          </ActionGroup>
        ) : null}
        {canConfirmContribution ? (
          <ActionGroup
            title="HORIC action"
            description="Confirm the Revenue Accountant's recommendation before returning it to the Area Manager."
            isAdminOverride={adminOverride}
          >
          <form
            action={confirmRegistrationContributionAction.bind(null, company.id)}
            className="grid gap-3"
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
          </ActionGroup>
        ) : null}
        {canReleaseContribution ? (
          <ActionGroup
            title="Area Manager action"
            description="Release the confirmed contribution recommendation to the employer dashboard or email."
            isAdminOverride={adminOverride}
          >
          <form
            action={releaseRegistrationContributionAction.bind(null, company.id)}
            className="grid gap-3"
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
          </ActionGroup>
        ) : null}
        {canReviewReceipt ? (
          <ActionGroup
            title="Area Manager action"
            description="Review the employer's uploaded contribution payment receipt."
            isAdminOverride={adminOverride}
          >
          <form
            action={reviewRegistrationContributionReceiptAction.bind(null, company.id)}
            className="grid gap-3"
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
          </ActionGroup>
        ) : null}
        {canNotifyHeadquarters ? (
          <ActionGroup
            title="Area Manager action"
            description="Notify Headquarters that registration payment has been verified by the Area Office."
            isAdminOverride={adminOverride}
          >
          <form
            action={notifyRegistrationHeadquartersAction.bind(null, company.id)}
            className="grid gap-3"
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
          </ActionGroup>
        ) : null}
        {canForwardToDivision ? (
          <ActionGroup
            title="Headquarters action"
            description="Forward the verified employer registration from Director FSD to the reimbursement division."
            isAdminOverride={adminOverride}
          >
          <form
            action={forwardRegistrationToDivisionAction.bind(null, company.id)}
            className="grid gap-3"
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
          </ActionGroup>
        ) : null}
        {canCompleteAtHeadquarters ? (
          <ActionGroup
            title="Headquarters action"
            description="Complete employer registration by assigning a managed ITF employer number."
            isAdminOverride={adminOverride}
          >
          <form
            action={completeRegistrationAtHeadquartersAction.bind(null, company.id)}
            className="grid gap-4"
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
          </ActionGroup>
        ) : null}
        {canAssessContribution ? (
          <ActionGroup
            title="Revenue Accountant action"
            description="Assess the submitted employer registration and recommend the contribution amount."
            isAdminOverride={adminOverride}
          >
          <form
            action={assessRegistrationContributionAction.bind(null, company.id)}
            className="grid gap-4"
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
          </ActionGroup>
        ) : null}
        {canUploadReceipt ? (
          <ActionGroup
            title="Employer actions"
            description="Upload proof of payment after the Area Manager releases the contribution recommendation."
            isAdminOverride={adminOverride}
          >
          <form
            action={uploadRegistrationContributionReceiptAction.bind(null, company.id)}
            className="grid gap-3"
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
          </ActionGroup>
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
              {visibleCompanyDocuments.map((document, index) => (
                <details
                  key={document.id}
                  open={index === 0}
                  className="group rounded-md border border-zinc-100 p-3 text-sm"
                >
                  <summary className="grid cursor-pointer list-none gap-2 rounded-md p-1 sm:grid-cols-[1fr_auto] sm:items-center">
                    <span>
                      <span className="block font-semibold">{document.fileName}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {document.kind.replaceAll("_", " ")} · {formatDate(document.createdAt)}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-[#800020] group-open:hidden">
                      Expand
                    </span>
                    <span className="hidden text-xs font-semibold text-zinc-500 group-open:inline">
                      Collapse
                    </span>
                  </summary>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <EvidenceActions
                      companyId={company.id}
                      documentId={document.id}
                      canDelete={canDeleteEvidence}
                    />
                  </div>
                </details>
              ))}
              {evidenceTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  <p>
                    Page {evidencePage} of {evidenceTotalPages} · Showing{" "}
                    {visibleCompanyDocuments.length} of {company.documents.length} evidence
                    documents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {evidencePage > 1 ? (
                      <Link
                        href={buildCompanyPageHref(company.id, {
                          evidencePage: evidencePage - 1,
                          compliancePage: compliancePage > 1 ? compliancePage : undefined,
                        })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Previous
                      </Link>
                    ) : null}
                    {evidencePage < evidenceTotalPages ? (
                      <Link
                        href={buildCompanyPageHref(company.id, {
                          evidencePage: evidencePage + 1,
                          compliancePage: compliancePage > 1 ? compliancePage : undefined,
                        })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Next
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Compliance years</h2>
            {canCreateComplianceYear ? (
              <Link
                href={`/registry/${company.id}/compliance/new`}
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
              >
                Create year
              </Link>
            ) : (
              <span className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-500">
                Registration required
              </span>
            )}
          </div>
          <div className="mt-4 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-3 text-xs leading-5 text-zinc-600">
            <p className="font-semibold text-zinc-900">Compliance visibility</p>
            <p className="mt-1">
              Area Office desks for {company.areaOffice?.name ?? "the selected Area Office"} can
              see annual compliance filings for awareness. Certificate review and issuance remain
              with Headquarters roles.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["AREA_MANAGER", "HORIC", "REVENUE_ACCOUNTANT"].map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-teal-200 bg-white px-2 py-1 font-semibold text-teal-800"
                >
                  {role.replaceAll("_", " ")} awareness
                </span>
              ))}
              {["HEAD_OF_DIVISION", "HQ_REVENUE_ACCOUNTANT"].map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-[#800020]/20 bg-white px-2 py-1 font-semibold text-[#65001a]"
                >
                  {role.replaceAll("_", " ")} action
                </span>
              ))}
            </div>
          </div>
          {!canCreateComplianceYear ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Compliance year creation opens after ITF completes registration and assigns the ITF
              employer number.
            </p>
          ) : null}
          {company.complianceYears.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No annual compliance returns have been created for this company yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {visibleComplianceYears.map((complianceYear, index) => (
                <details
                  key={complianceYear.id}
                  open={index === 0}
                  className="group rounded-md border border-zinc-100 p-3 text-sm"
                >
                  <summary className="grid cursor-pointer list-none gap-2 rounded-md p-1 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                    <p className="font-semibold">{complianceYear.year}</p>
                    <p>{complianceYear.status.replaceAll("_", " ")}</p>
                    <p>{formatMoney(complianceYear.amountPaid)}</p>
                    <span className="text-xs font-semibold text-[#800020] group-open:hidden">
                      Expand
                    </span>
                    <span className="hidden text-xs font-semibold text-zinc-500 group-open:inline">
                      Collapse
                    </span>
                  </summary>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
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
                          {canManageComplianceCertificate ? (
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
                          {canManageComplianceCertificate ? (
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
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/registry/${company.id}/compliance/${complianceYear.id}/review`}
                        className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                      >
                        Review year
                      </Link>
                      <Link
                        href={`/registry/${company.id}/compliance/${complianceYear.id}/evidence/new`}
                        className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                      >
                        Upload evidence
                      </Link>
                    </div>
                  </div>
                  {getRoleAvailableComplianceTransitions(
                    complianceYear.status,
                    activeRole,
                    adminOverride,
                  ).length > 0 ? (
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
                        {getRoleAvailableComplianceTransitions(
                          complianceYear.status,
                          activeRole,
                          adminOverride,
                        ).map((transition) => (
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
                  {canManageComplianceCertificate &&
                  complianceYear.status === "APPROVED" &&
                  !complianceYear.certificate ? (
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
                          <EvidenceActions
                            companyId={company.id}
                            documentId={document.id}
                            canDelete={canDeleteEvidence}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  </div>
                </details>
              ))}
              {complianceYearTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  <p>
                    Page {compliancePage} of {complianceYearTotalPages} · Showing{" "}
                    {visibleComplianceYears.length} of {company.complianceYears.length} compliance
                    years
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {compliancePage > 1 ? (
                      <Link
                        href={buildCompanyPageHref(company.id, {
                          compliancePage: compliancePage - 1,
                          evidencePage: evidencePage > 1 ? evidencePage : undefined,
                        })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Previous
                      </Link>
                    ) : null}
                    {compliancePage < complianceYearTotalPages ? (
                      <Link
                        href={buildCompanyPageHref(company.id, {
                          compliancePage: compliancePage + 1,
                          evidencePage: evidencePage > 1 ? evidencePage : undefined,
                        })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Next
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {canSubmitRegistration ? (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Registration submission</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Submit the employer registration package after confirming evidence and compliance
                context.
              </p>
            </div>
            {adminOverride ? (
              <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                Admin/testing override
              </span>
            ) : null}
          </div>
          <form
            action={submitRegistrationApplicationAction.bind(null, company.id)}
            className="mt-4 grid gap-4 border-t border-zinc-100 pt-4"
          >
            <RegistrationSubmissionFields
              initialRegistrationKind={
                company.registrationApplication?.registrationKind ?? "NEW_EMPLOYER"
              }
              initialClaimedItfEmployerNumber={
                company.registrationApplication?.claimedItfEmployerNumber ?? ""
              }
            />
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                {company.registrationApplication ? "Resubmit registration" : "Submit registration"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

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
          {hasCurrentYearCertifiedCompliance ? (
            <Link
              href={`/registry/${company.id}/training-plans/new`}
              className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
            >
              Create submission
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-500">
              Compliance required
            </span>
          )}
        </div>

        {!hasCurrentYearCertifiedCompliance ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Training Plan and L&amp;D submission is available after the company&apos;s {currentYear}{" "}
            compliance is approved and its compliance certificate has been issued.
          </p>
        ) : null}

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
              const availableTrainingPlanTransitions = getAvailableTrainingPlanTransitions(
                submission.currentDesk,
                submission.status,
              );
              const canRouteTrainingPlan =
                availableTrainingPlanTransitions.length > 0 &&
                canActAsTrainingPlanDesk(activeRole, submission.currentDesk);
              const hasCertifiedSubmissionYear = certifiedComplianceYears.has(submission.year);
              const canSubmitTrainingPlan =
                (submission.status === "DRAFT" || submission.status === "CHANGES_REQUESTED") &&
                missingRequiredEvidence.length === 0 &&
                hasCertifiedSubmissionYear &&
                (isEmployerRole(activeRole) || adminOverride);

              return (
                <div key={submission.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-4">
                    <p className="font-semibold">{submission.year}</p>
                    <p>{submission.status.replaceAll("_", " ")}</p>
                    <p>Desk: {formatDesk(submission.currentDesk)}</p>
                    <p>Due {formatDate(submission.dueDate)}</p>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600 md:grid-cols-2">
                    <p>
                      L&amp;D personnel count:{" "}
                      <span className="font-semibold text-zinc-800">
                        {submission.personnel.length}
                      </span>
                    </p>
                    <p>Submitted: {formatDate(submission.submittedAt)}</p>
                    <p>Prompt score: {formatPercent(submission.promptSubmissionScore)}</p>
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
                  {!hasCertifiedSubmissionYear ? (
                    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Approved {submission.year} compliance with an issued certificate is required
                      before evidence upload or submission.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <p className="text-xs text-zinc-500">
                      {submission.documents.length === 0
                        ? "No Training Plan evidence uploaded"
                        : `${submission.documents.length} evidence document${submission.documents.length === 1 ? "" : "s"}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/training-plans/${submission.id}`}
                        className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                      >
                        View detail
                      </Link>
                    {hasCertifiedSubmissionYear ? (
                      <Link
                        href={`/registry/${company.id}/training-plans/${submission.id}/evidence/new`}
                        className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                      >
                        Upload evidence
                      </Link>
                    ) : null}
                    </div>
                  </div>
                  {canSubmitTrainingPlan ? (
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
                  {canRouteTrainingPlan ? (
                    <form
                      action={routeTrainingPlanSubmissionAction.bind(
                        null,
                        company.id,
                        submission.id,
                      )}
                      className="mt-3 grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Training Plan workflow action
                        </p>
                        {adminOverride ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            Admin/testing override
                          </span>
                        ) : null}
                      </div>
                      <label className="grid gap-2 text-xs font-medium text-zinc-700">
                        Routing note
                        <input
                          name="note"
                          className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableTrainingPlanTransitions.map((transition) => (
                          <button
                            key={transition}
                            name="transition"
                            value={transition}
                            className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900"
                          >
                            {trainingPlanTransitionLabels[transition]}
                          </button>
                        ))}
                      </div>
                    </form>
                  ) : submission.status === "SUBMITTED" || submission.status === "IN_REVIEW" ? (
                    <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                      No Training Plan action is currently assigned to your role. Current desk is{" "}
                      <span className="font-semibold text-zinc-900">
                        {formatDesk(submission.currentDesk)}
                      </span>
                      .
                    </p>
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
                          <EvidenceActions
                            companyId={company.id}
                            documentId={document.id}
                            canDelete={canDeleteEvidence}
                          />
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
