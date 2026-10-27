import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { deleteCompanyEvidenceAction } from "@/app/(dashboard)/registry/[companyId]/evidence/actions";
import { EvidenceDeleteButton } from "@/app/(dashboard)/registry/[companyId]/evidence/evidence-delete-button";
import {
  generateComplianceCertificatePdfAction,
  issueComplianceCertificateAction,
  updateComplianceYearStatusAction,
} from "@/app/(dashboard)/registry/[companyId]/compliance/actions";
import {
  routeTrainingPlanSubmissionAction,
} from "@/app/(dashboard)/registry/[companyId]/training-plans/actions";
import {
  assessRegistrationContributionAction,
  completeRegistrationAtHeadquartersAction,
  confirmRegistrationContributionAction,
  forwardRegistrationToDivisionAction,
  forwardRegistrationToRevenueAccountantAction,
  generateContributionInvoicePdfAction,
  initiateRemitaPaymentAction,
  notifyRegistrationHeadquartersAction,
  recordLegacyRegistrationAction,
  releaseRegistrationContributionAction,
  reconcileRemitaPaymentAction,
  reviewLegacyRegistrationClaimAction,
  reviewRegistrationContributionReceiptAction,
  routeRegistrationApplicationAction,
  submitRegistrationApplicationAction,
  uploadRegistrationContributionReceiptAction,
} from "@/app/(dashboard)/registry/[companyId]/registration/actions";
import { RegistrationSubmissionFields } from "@/app/(dashboard)/registry/[companyId]/registration/RegistrationSubmissionFields";
import { authOptions } from "@/lib/auth";
import { isEvidenceWorkflowEditable } from "@/lib/evidence-deletion";
import { listAvailableManagedNumbers } from "@/lib/managed-numbers";
import { isRemitaConfigured } from "@/lib/remita";
import { canManageAnnualCompliance, type Role } from "@/lib/rbac";
import { getEmployerCompany } from "@/lib/registry";
import { listAssignableTrainingPlanReimbursementOfficers } from "@/lib/training-plan";
import {
  formatRevenueWorkflowMode,
  usesInAppRevenueWorkflow,
} from "@/lib/revenue-workflow";

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

function readFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();

  return trimmed ? trimmed : undefined;
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

function HighlightedRemark({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!children) {
    return null;
  }

  return (
    <span className="ml-1 font-semibold text-[#800020]">
      · {children}
    </span>
  );
}

function getTrainingPlanStatusBadgeClass(status: string) {
  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "REJECTED") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "SUBMITTED" || status === "IN_REVIEW") {
    return "bg-orange-50 text-orange-700 ring-orange-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function TrainingPlanStatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span
      className={`inline-flex min-h-7 w-fit items-center rounded-full px-2.5 text-xs font-semibold ring-1 ${getTrainingPlanStatusBadgeClass(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function HiddenQueryInputs({
  values,
  omit = [],
}: Readonly<{
  values: Record<string, string | number | undefined>;
  omit?: string[];
}>) {
  return (
    <>
      {Object.entries(values).map(([name, value]) =>
        value !== undefined && !omit.includes(name) ? (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ) : null,
      )}
    </>
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
  viewHref,
  canDelete,
  showLocked,
}: Readonly<{
  companyId: string;
  documentId: string;
  viewHref?: string;
  canDelete: boolean;
  showLocked?: boolean;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={viewHref ?? `/registry/${companyId}/evidence/${documentId}?disposition=inline`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800"
      >
        View
      </Link>
      {canDelete ? (
        <EvidenceDeleteButton
          action={deleteCompanyEvidenceAction.bind(null, companyId, documentId)}
        />
      ) : showLocked ? (
        <span
          className="inline-flex min-h-8 items-center rounded-md bg-zinc-100 px-2 text-xs font-semibold text-zinc-500"
          title="Submitted evidence is permanently locked."
        >
          Locked after submission
        </span>
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
  horic_to_ra_for_correction: "Return recommendation to RA",
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
  hot_to_company: "Request employer correction",
  ro_to_company: "Request employer correction",
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

  if (role === "HEAD_INSPECTORATE_COMPLIANCE" || role === "HQ_REVENUE_ACCOUNTANT") {
    return {
      title: "Headquarters compliance desk",
      detail:
        "Review annual compliance returns, manage compliance certificate numbers, and issue certificates after HQ approval.",
    };
  }

  if (role === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE") {
    return {
      title: "Director RIC desk",
      detail:
        "Receive headquarters registration notifications and forward registration packages to Inspectorate & Compliance.",
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
      return ["horic_to_ra_for_correction"] as const;
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

  if (desk === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE") {
    return role === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE";
  }

  if (desk === "HEAD_INSPECTORATE_COMPLIANCE") {
    return role === "HEAD_INSPECTORATE_COMPLIANCE";
  }

  if (desk === "HQ_REVENUE_ACCOUNTANT") {
    return role === "HQ_REVENUE_ACCOUNTANT";
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
    role === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE" ||
    role === "HEAD_INSPECTORATE_COMPLIANCE" ||
    role === "HQ_REVENUE_ACCOUNTANT" ||
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
    return ["hot_to_ro", "hot_to_am", "hot_to_company"] as const;
  }

  if (currentDesk === "REIMBURSEMENT_OFFICER") {
    return ["ro_to_hot", "ro_to_company"] as const;
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
    complianceStatus?: string | string[];
    complianceYear?: string | string[];
    certificatePage?: string | string[];
    certificateStatus?: string | string[];
    certificateYear?: string | string[];
    evidencePage?: string | string[];
    evidenceKind?: string | string[];
    evidenceQ?: string | string[];
    trainingDesk?: string | string[];
    trainingPage?: string | string[];
    trainingStatus?: string | string[];
    trainingYear?: string | string[];
  }>;
}>) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const company = await getEmployerCompany(companyId, {
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  if (!company) {
    notFound();
  }

  const activeRole = session.user.role;
  const requesterId = session.user.id;
  const roOfficers = activeRole === "HEAD_OF_TRAINING" || isAdminRole(activeRole)
    ? await listAssignableTrainingPlanReimbursementOfficers(company.organization.workspaceId, company.areaOfficeId)
    : [];
  const roleFocus = getRegistryRoleFocus(activeRole);
  const adminOverride = isAdminRole(activeRole);
  const canDeleteEvidence = isEmployerRole(activeRole);
  const revenueWorkflowMode = company.organization.workspace.revenueWorkflowMode;
  const usesInAppRevenue = usesInAppRevenueWorkflow(revenueWorkflowMode);
  const remitaConfigured = usesInAppRevenue && isRemitaConfigured();
  const registrationEvidenceEditable = isEvidenceWorkflowEditable([
    company.registrationApplication?.status,
  ]);
  const currentYear = new Date().getFullYear();
  const evidenceKind = readFilter(query.evidenceKind);
  const evidenceSearch = readFilter(query.evidenceQ);
  const complianceStatus = readFilter(query.complianceStatus);
  const complianceYear = readFilter(query.complianceYear);
  const certificateStatus = readFilter(query.certificateStatus);
  const certificateYear = readFilter(query.certificateYear);
  const trainingStatus = readFilter(query.trainingStatus);
  const trainingDesk = readFilter(query.trainingDesk);
  const trainingYear = readFilter(query.trainingYear);
  const filteredCompanyDocuments = company.documents.filter((document) => {
    const matchesKind = evidenceKind ? document.kind === evidenceKind : true;
    const matchesSearch = evidenceSearch
      ? [document.documentName, document.fileName, document.kind]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(evidenceSearch.toLowerCase()))
      : true;

    return matchesKind && matchesSearch;
  });
  const evidenceDocumentsPerPage = 5;
  const evidenceTotalPages = Math.ceil(filteredCompanyDocuments.length / evidenceDocumentsPerPage);
  const evidencePage = clampPage(readPositiveInteger(query.evidencePage), evidenceTotalPages);
  const visibleCompanyDocuments = filteredCompanyDocuments.slice(
    (evidencePage - 1) * evidenceDocumentsPerPage,
    evidencePage * evidenceDocumentsPerPage,
  );
  const filteredComplianceYears = company.complianceYears.filter((complianceYearItem) => {
    const matchesStatus = complianceStatus ? complianceYearItem.status === complianceStatus : true;
    const matchesYear = complianceYear
      ? complianceYearItem.year === Number.parseInt(complianceYear, 10)
      : true;

    return matchesStatus && matchesYear;
  });
  const complianceYearsPerPage = 5;
  const complianceYearTotalPages = Math.ceil(
    filteredComplianceYears.length / complianceYearsPerPage,
  );
  const compliancePage = clampPage(
    readPositiveInteger(query.compliancePage),
    complianceYearTotalPages,
  );
  const visibleComplianceYears = filteredComplianceYears.slice(
    (compliancePage - 1) * complianceYearsPerPage,
    compliancePage * complianceYearsPerPage,
  );
  const certificateComplianceYears = company.complianceYears
    .filter((complianceYearItem) => complianceYearItem.certificate)
    .filter((complianceYearItem) => {
      const matchesStatus = certificateStatus
        ? complianceYearItem.certificate?.status === certificateStatus
        : true;
      const matchesYear = certificateYear
        ? complianceYearItem.year === Number.parseInt(certificateYear, 10)
        : true;

      return matchesStatus && matchesYear;
    });
  const certificatesPerPage = 5;
  const certificateTotalPages = Math.ceil(certificateComplianceYears.length / certificatesPerPage);
  const certificatePage = clampPage(
    readPositiveInteger(query.certificatePage),
    certificateTotalPages,
  );
  const visibleCertificateComplianceYears = certificateComplianceYears.slice(
    (certificatePage - 1) * certificatesPerPage,
    certificatePage * certificatesPerPage,
  );
  const filteredTrainingPlanSubmissions = company.trainingPlanSubmissions.filter((submission) => {
    const matchesStatus = trainingStatus ? submission.status === trainingStatus : true;
    const matchesDesk = trainingDesk ? submission.currentDesk === trainingDesk : true;
    const matchesYear = trainingYear ? submission.year === Number.parseInt(trainingYear, 10) : true;

    return matchesStatus && matchesDesk && matchesYear;
  });
  const trainingSubmissionsPerPage = 5;
  const trainingSubmissionTotalPages = Math.ceil(
    filteredTrainingPlanSubmissions.length / trainingSubmissionsPerPage,
  );
  const trainingPage = clampPage(readPositiveInteger(query.trainingPage), trainingSubmissionTotalPages);
  const visibleTrainingPlanSubmissions = filteredTrainingPlanSubmissions.slice(
    (trainingPage - 1) * trainingSubmissionsPerPage,
    trainingPage * trainingSubmissionsPerPage,
  );
  const companyPageQuery = {
    compliancePage: compliancePage > 1 ? compliancePage : undefined,
    complianceStatus,
    complianceYear,
    certificatePage: certificatePage > 1 ? certificatePage : undefined,
    certificateStatus,
    certificateYear,
    evidencePage: evidencePage > 1 ? evidencePage : undefined,
    evidenceKind,
    evidenceQ: evidenceSearch,
    trainingDesk,
    trainingPage: trainingPage > 1 ? trainingPage : undefined,
    trainingStatus,
    trainingYear,
  };
  const companyHref = (overrides: Record<string, string | number | undefined>) =>
    buildCompanyPageHref(company.id, {
      ...companyPageQuery,
      ...overrides,
    });
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
    usesInAppRevenue &&
    !company.itfEmployerNumber &&
    (!registrationApplication ||
      (registrationApplication.currentDesk === "COMPANY" &&
        registrationApplication.status === "CHANGES_REQUESTED")) &&
    Boolean(company.areaOffice) &&
    (isEmployerRole(activeRole) || adminOverride);
  const canRouteRegistration =
    usesInAppRevenue &&
    !company.itfEmployerNumber &&
    Boolean(registrationApplication) &&
    availableRegistrationTransitions.length > 0 &&
    canActAsDesk(activeRole, registrationApplication?.currentDesk) &&
    registrationApplication?.currentDesk !== "REVENUE_ACCOUNTANT";
  const canConfirmContribution =
    usesInAppRevenue &&
    registrationApplication?.currentDesk === "HORIC" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment) &&
    !registrationApplication.contributionAssessment?.horicReviewedAt &&
    canActAsDesk(activeRole, "HORIC");
  const canReleaseContribution =
    usesInAppRevenue &&
    registrationApplication?.currentDesk === "AREA_MANAGER" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment?.horicReviewedAt) &&
    !registrationApplication.contributionAssessment?.amReleasedAt &&
    canActAsDesk(activeRole, "AREA_MANAGER");
  const canReviewReceipt =
    usesInAppRevenue &&
    registrationApplication?.currentDesk === "AREA_MANAGER" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment?.amReleasedAt) &&
    registrationApplication.documents.length > 0 &&
    canActAsDesk(activeRole, "AREA_MANAGER");
  const canNotifyHeadquarters =
    usesInAppRevenue &&
    registrationApplication?.currentDesk === "AREA_MANAGER" &&
    registrationApplication.status === "IN_REVIEW" &&
    Boolean(registrationApplication.contributionAssessment?.amReleasedAt) &&
    (registrationApplication.documents.length > 0 ||
      registrationApplication.contributionAssessment?.invoice?.status === "PAID") &&
    canActAsDesk(activeRole, "AREA_MANAGER");
  const canAssessContribution =
    usesInAppRevenue &&
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
    usesInAppRevenue &&
    registrationApplication?.currentDesk === "COMPANY" &&
    registrationApplication.status === "SUBMITTED" &&
    Boolean(registrationApplication.contributionAssessment?.amReleasedAt) &&
    registrationApplication.contributionAssessment?.invoice?.status !== "PAID" &&
    (isEmployerRole(activeRole) || adminOverride);
  const canForwardToDivision =
    usesInAppRevenue &&
    !company.itfEmployerNumber &&
    registrationApplication?.currentDesk === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE" &&
    registrationApplication.status === "IN_REVIEW" &&
    canActAsDesk(activeRole, "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE");
  const canForwardToRevenueAccountant =
    usesInAppRevenue &&
    !company.itfEmployerNumber &&
    registrationApplication?.currentDesk === "HEAD_INSPECTORATE_COMPLIANCE" &&
    registrationApplication.status === "IN_REVIEW" &&
    canActAsDesk(activeRole, "HEAD_INSPECTORATE_COMPLIANCE");
  const canCompleteAtHeadquarters =
    usesInAppRevenue &&
    !company.itfEmployerNumber &&
    registrationApplication?.currentDesk === "HQ_REVENUE_ACCOUNTANT" &&
    registrationApplication.status === "IN_REVIEW" &&
    canActAsDesk(activeRole, "HQ_REVENUE_ACCOUNTANT");
  const availableItfEmployerNumbers =
    canCompleteAtHeadquarters
      ? await listAvailableManagedNumbers({
          requesterRole: activeRole,
          workspaceId: company.organization.workspaceId,
          type: "ITF_EMPLOYER_NUMBER",
        })
      : [];
  const canRecordLegacyRegistration =
    !company.itfEmployerNumber &&
    canRecordLegacyRegistrationRole(activeRole) &&
    (!registrationApplication ||
      registrationApplication.registrationKind === "LEGACY_EMPLOYER");
  const canCreateComplianceYear = Boolean(company.itfEmployerNumber) && isEmployerRole(activeRole);
  const canCreateTrainingPlan = isEmployerRole(activeRole);
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
    canForwardToRevenueAccountant ||
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
  const hasActionableComplianceYear = company.complianceYears.some(
    (complianceYear) =>
      getRoleAvailableComplianceTransitions(complianceYear.status, activeRole, adminOverride).length > 0,
  );
  const hasActionableTrainingPlanSubmission = company.trainingPlanSubmissions.some(
    (submission) =>
      getAvailableTrainingPlanTransitions(submission.currentDesk, submission.status).length > 0 &&
      canActAsTrainingPlanDesk(activeRole, submission.currentDesk) &&
      (adminOverride || submission.currentDesk !== "REIMBURSEMENT_OFFICER" ||
        !submission.workItems[0]?.assignedUserId || submission.workItems[0].assignedUserId === requesterId),
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
            {usesInAppRevenue
              ? "Form 7A profile, ITF registration state, supporting evidence summary, and compliance history for this employer company."
              : "Employer profile, ITF registration number, training submissions, and supporting evidence for reimbursement."}
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
        {!usesInAppRevenue ? (
          <div className="mt-4 rounded-md border border-[#800020]/20 bg-[#800020]/5 px-3 py-2 text-sm leading-6 text-zinc-700">
            Revenue workflow mode is{" "}
            <span className="font-semibold text-zinc-950">
              {formatRevenueWorkflowMode(revenueWorkflowMode)}
            </span>
            . Registration contribution invoices, Remita payments, and revenue-accountant payment
            review actions are hidden; reimbursement eligibility should be verified from claim-side
            contribution/payment evidence.
          </div>
        ) : null}
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

      {usesInAppRevenue && (!company.itfEmployerNumber ? (
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
      ))}

      <details
        open={Boolean(
          company.registrationApplication &&
            company.registrationApplication.status !== "APPROVED",
        )}
        className="group mt-8 rounded-lg border border-zinc-200 bg-white p-5"
      >
        <summary className="flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Registration workflow</h2>
            <p className="mt-1 text-xs font-semibold text-[#800020] group-open:hidden">
              Expand card
            </p>
            <p className="mt-1 hidden text-xs font-semibold text-zinc-500 group-open:block">
              Collapse card
            </p>
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
                workflow yet. Submit registration before annual compliance filing becomes available.
              </p>
            )}
          </div>
        </summary>
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
                  <HighlightedRemark>
                    {company.registrationApplication.decisions[0].reason}
                  </HighlightedRemark>
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
                      <HighlightedRemark>
                        {company.registrationApplication.contributionAssessment.horicReviewNote}
                      </HighlightedRemark>
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
                      <HighlightedRemark>
                        {company.registrationApplication.contributionAssessment.amReleaseNote}
                      </HighlightedRemark>
                      {company.registrationApplication.contributionAssessment.releaseChannel
                        ? ` · ${company.registrationApplication.contributionAssessment.releaseChannel.replaceAll("_", " ")}`
                        : ""}
                    </p>
                  ) : null}
                  {usesInAppRevenue &&
                  company.registrationApplication.contributionAssessment.invoice ? (
                    <div className="md:col-span-3 rounded-md border border-[#800020]/15 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Contribution invoice
                          </p>
                          <p className="mt-1 font-semibold text-zinc-950">
                            {
                              company.registrationApplication.contributionAssessment.invoice
                                .invoiceNumber
                            }{" "}
                            ·{" "}
                            {formatMoney(
                              company.registrationApplication.contributionAssessment.invoice.amount,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {
                              company.registrationApplication.contributionAssessment.invoice
                                .status
                            }{" "}
                            · Issued{" "}
                            {formatDate(
                              company.registrationApplication.contributionAssessment.invoice
                                .issuedAt,
                            )}
                          </p>
                        </div>
                        {company.registrationApplication.contributionAssessment.invoice
                          .generatedDocumentId ? (
                          <Link
                            href={`/registry/${company.id}/registration/invoice/${company.registrationApplication.contributionAssessment.invoice.id}`}
                            className="inline-flex min-h-9 items-center rounded-md bg-[#800020] px-3 text-xs font-semibold text-white"
                          >
                            Download invoice
                          </Link>
                        ) : (
                          <form
                            action={generateContributionInvoicePdfAction.bind(
                              null,
                              company.id,
                              company.registrationApplication.contributionAssessment.invoice.id,
                            )}
                          >
                            <button className="min-h-9 rounded-md border border-[#800020]/20 bg-white px-3 text-xs font-semibold text-[#65001a]">
                              Generate invoice PDF
                            </button>
                            <FormActionProgress />
                          </form>
                        )}
                      </div>
                      <div className="mt-3 border-t border-zinc-100 pt-3">
                        {company.registrationApplication.contributionAssessment.invoice
                          .payments[0] ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-zinc-900">
                                Remita payment:{" "}
                                {
                                  company.registrationApplication.contributionAssessment.invoice
                                    .payments[0].status
                                }
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                RRR:{" "}
                                {company.registrationApplication.contributionAssessment.invoice
                                  .payments[0].providerReference ?? "Pending generation"}
                                {company.registrationApplication.contributionAssessment.invoice
                                  .payments[0].statusMessage
                                  ? ` · ${company.registrationApplication.contributionAssessment.invoice.payments[0].statusMessage}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {company.registrationApplication.contributionAssessment.invoice
                                .payments[0].paymentUrl &&
                              company.registrationApplication.contributionAssessment.invoice
                                .payments[0].status !== "SUCCESSFUL" ? (
                                <a
                                  href={
                                    company.registrationApplication.contributionAssessment.invoice
                                      .payments[0].paymentUrl ?? undefined
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-9 items-center rounded-md bg-[#800020] px-3 text-xs font-semibold text-white"
                                >
                                  Continue with Remita
                                </a>
                              ) : null}
                              {company.registrationApplication.contributionAssessment.invoice
                                .payments[0].providerReference &&
                              company.registrationApplication.contributionAssessment.invoice
                                .payments[0].status !== "SUCCESSFUL" ? (
                                <form
                                  action={reconcileRemitaPaymentAction.bind(
                                    null,
                                    company.id,
                                    company.registrationApplication.contributionAssessment.invoice
                                      .payments[0].providerReference ?? "",
                                  )}
                                >
                                  <button className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800">
                                    Check payment status
                                  </button>
                                  <FormActionProgress />
                                </form>
                              ) : null}
                            </div>
                          </div>
                        ) : isEmployerRole(activeRole) && remitaConfigured ? (
                          <form
                            action={initiateRemitaPaymentAction.bind(
                              null,
                              company.id,
                              company.registrationApplication.contributionAssessment.invoice.id,
                            )}
                          >
                            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                              Pay with Remita
                            </button>
                            <FormActionProgress />
                          </form>
                        ) : isEmployerRole(activeRole) ? (
                          <p className="text-xs leading-5 text-zinc-500">
                            Remita payment will become available after ITF configures the approved
                            merchant credentials and endpoint templates.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {usesInAppRevenue &&
            company.registrationApplication.contributionAssessment?.amReleasedAt ? (
              <div className="md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Payment receipt
                </p>
                {company.registrationApplication.contributionAssessment?.invoice?.status ===
                "PAID" ? (
                  <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Payment was confirmed directly through Remita. A separate receipt upload is not
                    required.
                  </p>
                ) : company.registrationApplication.documents.length === 0 ? (
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
                          canDelete={canDeleteEvidence && registrationEvidenceEditable}
                          showLocked={canDeleteEvidence && !registrationEvidenceEditable}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {usesInAppRevenue &&
            company.registrationApplication.currentDesk ===
              "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE" &&
            company.registrationApplication.status === "IN_REVIEW" ? (
              <div className="md:col-span-3">
                <p className="rounded-md bg-[#800020]/10 px-3 py-2 text-sm font-semibold text-[#65001a]">
                  Headquarters notification is pending with Director, Revenue, Inspectorate &
                  Compliance.
                </p>
              </div>
            ) : null}
            {usesInAppRevenue &&
            company.registrationApplication.currentDesk === "HEAD_INSPECTORATE_COMPLIANCE" &&
            company.registrationApplication.status === "IN_REVIEW" ? (
              <div className="md:col-span-3">
                <p className="rounded-md bg-[#800020]/10 px-3 py-2 text-sm font-semibold text-[#65001a]">
                  Employer registration is pending with Head, Inspectorate & Compliance Division.
                </p>
              </div>
            ) : null}
            {usesInAppRevenue &&
            company.registrationApplication.currentDesk === "HQ_REVENUE_ACCOUNTANT" &&
            company.registrationApplication.status === "IN_REVIEW" ? (
              <div className="md:col-span-3">
                <p className="rounded-md bg-[#800020]/10 px-3 py-2 text-sm font-semibold text-[#65001a]">
                  Employer registration completion is pending with HQ Revenue Accountant.
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
              <FormActionProgress />
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
            <FormActionProgress />
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
              <FormActionProgress />
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
            <FormActionProgress />
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
            <FormActionProgress />
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
            <FormActionProgress />
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
            <FormActionProgress />
          </form>
          </ActionGroup>
        ) : null}
        {canForwardToDivision ? (
          <ActionGroup
            title="Headquarters action"
            description="Forward the verified employer registration from Director RIC to Head, Inspectorate & Compliance Division."
            isAdminOverride={adminOverride}
          >
          <form
            action={forwardRegistrationToDivisionAction.bind(null, company.id)}
            className="grid gap-3"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Director RIC forwarding note
              <input
                name="note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Forward to Head Inspectorate & Compliance
              </button>
            </div>
            <FormActionProgress />
          </form>
          </ActionGroup>
        ) : null}
        {canForwardToRevenueAccountant ? (
          <ActionGroup
            title="Headquarters action"
            description="Forward the employer registration to HQ Revenue Accountant for number assignment and completion."
            isAdminOverride={adminOverride}
          >
          <form
            action={forwardRegistrationToRevenueAccountantAction.bind(null, company.id)}
            className="grid gap-3"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Inspectorate & Compliance forwarding note
              <input
                name="note"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Forward to HQ Revenue Accountant
              </button>
            </div>
            <FormActionProgress />
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
              HQ Revenue Accountant completion note
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
            <FormActionProgress />
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
            <FormActionProgress />
          </form>
          <form
            action={routeRegistrationApplicationAction.bind(null, company.id)}
            className="mt-4 grid gap-3 border-t border-zinc-100 pt-4"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Correction request note
              <input
                name="reason"
                required
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <div>
              <button
                name="transition"
                value="ra_to_company"
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900"
              >
                Request employer correction instead
              </button>
            </div>
            <FormActionProgress />
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
              <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
                name="receipt"
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
            <FormActionProgress />
          </form>
          </ActionGroup>
        ) : null}
      </details>

      <details
        open={hasActionableTrainingPlanSubmission}
        className="group mt-8 rounded-lg border border-zinc-200 bg-white p-5"
      >
        <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Training Plan and L&amp;D submissions
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Yearly Form 3A personnel details, annual training plan evidence, and L&amp;D
              personnel CV and highest qualification certificate evidence (which may be one PDF).
            </p>
            <p className="mt-1 text-xs font-semibold text-[#800020] group-open:hidden">Expand card</p>
            <p className="mt-1 hidden text-xs font-semibold text-zinc-500 group-open:block">Collapse card</p>
          </div>
          {canCreateTrainingPlan ? (
            <Link
              href={`/registry/${company.id}/training-plans/new`}
              className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
            >
              Create submission
            </Link>
          ) : null}
        </summary>

        <p className="mt-4 text-xs text-zinc-600">Annual payment will be verified when a reimbursement claim is made, not when the Training Plan is submitted.</p>

        <form className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <HiddenQueryInputs
            values={companyPageQuery}
            omit={["trainingPage", "trainingStatus", "trainingDesk", "trainingYear"]}
          />
          <label className="grid gap-1 text-xs font-medium text-zinc-700">
            Year
            <input
              name="trainingYear"
              type="number"
              defaultValue={trainingYear}
              className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-700">
            Status
            <select
              name="trainingStatus"
              defaultValue={trainingStatus ?? ""}
              className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">Any status</option>
              {[
                "DRAFT",
                "SUBMITTED",
                "IN_REVIEW",
                "CHANGES_REQUESTED",
                "APPROVED",
                "REJECTED",
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-700">
            Desk
            <select
              name="trainingDesk"
              defaultValue={trainingDesk ?? ""}
              className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">Any desk</option>
              {["COMPANY", "AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"].map(
                (desk) => (
                  <option key={desk} value={desk}>
                    {desk.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="flex items-end">
            <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
              Filter
            </button>
          </div>
          <FormActionProgress />
        </form>

        {filteredTrainingPlanSubmissions.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            No Training Plan and L&amp;D submission matches the selected filters.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {visibleTrainingPlanSubmissions.map((submission) => {
              const submittedDocumentKinds = new Set(
                submission.documents.map((document) => document.kind),
              );
              const missingRequiredEvidence = [
                submittedDocumentKinds.has("TRAINING_PLAN_DOCUMENT")
                  ? undefined
                  : "training plan document",
                submittedDocumentKinds.has("LD_PERSONNEL_CV") ? undefined : "L&D personnel CV and highest qualification certificate",
              ].filter(Boolean);
              const availableTrainingPlanTransitions = getAvailableTrainingPlanTransitions(
                submission.currentDesk,
                submission.status,
              );
              const canRouteTrainingPlan =
                availableTrainingPlanTransitions.length > 0 &&
                canActAsTrainingPlanDesk(activeRole, submission.currentDesk) &&
                (adminOverride || submission.currentDesk !== "REIMBURSEMENT_OFFICER" ||
                  !submission.workItems[0]?.assignedUserId || submission.workItems[0].assignedUserId === requesterId);
              const canSubmitTrainingPlan =
                (submission.status === "DRAFT" || submission.status === "CHANGES_REQUESTED") &&
                missingRequiredEvidence.length === 0 &&
                (isEmployerRole(activeRole) || adminOverride);
              const shouldOpenSubmission = canRouteTrainingPlan || canSubmitTrainingPlan;

              return (
                <details
                  key={submission.id}
                  open={shouldOpenSubmission}
                  className="group rounded-md border border-zinc-100 p-3 text-sm"
                >
                  <summary className="grid cursor-pointer list-none gap-2 rounded-md p-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-center">
                    <p className="font-semibold">{submission.year}</p>
                    <TrainingPlanStatusBadge status={submission.status} />
                    <p>Desk: {formatDesk(submission.currentDesk)}</p>
                    <p>Due {formatDate(submission.dueDate)}</p>
                    <span className="text-xs font-semibold text-[#800020] group-open:hidden">
                      Expand
                    </span>
                    <span className="hidden text-xs font-semibold text-zinc-500 group-open:inline">
                      Collapse
                    </span>
                  </summary>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
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
                        <HighlightedRemark>
                          {submission.decisions[0].reason}
                        </HighlightedRemark>
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
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/training-plans/${submission.id}`}
                        className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
                      >
                        View detail
                      </Link>
                    {isEmployerRole(activeRole) && missingRequiredEvidence.length > 0 ? (
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
                    <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Package is ready to submit. Open View detail to review and submit it.
                    </p>
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
                      {submission.currentDesk === "REIMBURSEMENT_OFFICER" ? (
                        <label className="grid gap-2 text-xs font-medium text-zinc-700">
                          Recommendation to HOT
                          <select name="recommendation" required className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm">
                            <option value="">Select approval or rejection</option>
                            <option value="APPROVE">Recommend approval</option>
                            <option value="REJECT">Recommend rejection</option>
                          </select>
                        </label>
                      ) : null}
                      {submission.currentDesk === "HEAD_OF_TRAINING" ? (
                        <label className="grid gap-2 text-xs font-medium text-zinc-700">
                          Reimbursement Officer for “Forward to Reimbursement Officer”
                          <select name="assigneeUserId" defaultValue={roOfficers.length === 1 ? roOfficers[0].id : ""} className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm">
                            <option value="">Select an officer</option>
                            {roOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} ({officer.email})</option>)}
                          </select>
                          {!roOfficers.length ? <span className="text-red-800">No active Reimbursement Officer is configured for this Area Office.</span> : null}
                        </label>
                      ) : null}
                      <label className="grid gap-2 text-xs font-medium text-zinc-700">
                        {submission.currentDesk === "REIMBURSEMENT_OFFICER" ? "Approval / rejection / correction remark" : "Routing note"}
                        <input
                          name="note"
                          className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                        />
                      </label>
                      {submission.currentDesk === "REIMBURSEMENT_OFFICER" ? (
                        <p className="text-xs text-zinc-600">A remark is required for rejection or employer correction; it is optional for approval.</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {availableTrainingPlanTransitions.map((transition) => (
                          <button
                            key={transition}
                            name="transition"
                            value={transition}
                            formNoValidate={transition === "ro_to_company"}
                            className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900"
                          >
                            {trainingPlanTransitionLabels[transition]}
                          </button>
                        ))}
                      </div>
                      <FormActionProgress />
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
                            viewHref={["AREA_MANAGER", "HEAD_OF_TRAINING", "REIMBURSEMENT_OFFICER"].includes(activeRole) && document.kind === "TRAINING_PLAN_DOCUMENT"
                              ? `/training-plans/${submission.id}/pdf`
                              : undefined}
                            canDelete={
                              canDeleteEvidence &&
                              isEvidenceWorkflowEditable([submission.status])
                            }
                            showLocked={
                              canDeleteEvidence &&
                              !isEvidenceWorkflowEditable([submission.status])
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  </div>
                </details>
              );
            })}
            {trainingSubmissionTotalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                <p>
                  Page {trainingPage} of {trainingSubmissionTotalPages} · Showing{" "}
                  {visibleTrainingPlanSubmissions.length} of{" "}
                  {filteredTrainingPlanSubmissions.length} submission
                  {filteredTrainingPlanSubmissions.length === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {trainingPage > 1 ? (
                    <Link
                      href={companyHref({ trainingPage: trainingPage - 1 })}
                      className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                    >
                      Previous
                    </Link>
                  ) : null}
                  {trainingPage < trainingSubmissionTotalPages ? (
                    <Link
                      href={companyHref({ trainingPage: trainingPage + 1 })}
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
      </details>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <details className={`group order-2 min-w-0 rounded-lg border border-zinc-200 bg-white p-5 ${usesInAppRevenue ? "" : "lg:col-span-2"}`}>
          <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Evidence summary</h2>
              <p className="mt-1 text-xs font-semibold text-[#800020] group-open:hidden">
                Expand card
              </p>
              <p className="mt-1 hidden text-xs font-semibold text-zinc-500 group-open:block">
                Collapse card
              </p>
            </div>
          </summary>
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-zinc-600">
              {usesInAppRevenue
                ? "Supporting files uploaded for this company profile."
                : "Supporting files for this company and its reimbursement submissions."}
            </p>
            <Link
              href={`/registry/${company.id}/evidence/new`}
              className="inline-flex min-h-10 items-center rounded-md bg-[#800020] px-3 text-sm font-semibold text-white"
            >
              Upload evidence
            </Link>
          </div>
          <form className="mt-4 grid min-w-0 gap-3 rounded-md bg-zinc-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto]">
            <HiddenQueryInputs
              values={companyPageQuery}
              omit={["evidencePage", "evidenceQ", "evidenceKind"]}
            />
            <label className="grid gap-1 text-xs font-medium text-zinc-700">
              Search evidence
              <input
                name="evidenceQ"
                defaultValue={evidenceSearch}
                className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-700">
              Type
              <select
                name="evidenceKind"
                defaultValue={evidenceKind ?? ""}
                className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Any type</option>
                {Array.from(new Set(company.documents.map((document) => document.kind))).map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {kind.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="flex min-w-0 items-end">
              <button className="min-h-9 w-full rounded-md bg-[#800020] px-3 text-xs font-semibold text-white md:w-auto">
                Filter
              </button>
            </div>
            <FormActionProgress />
          </form>
          {filteredCompanyDocuments.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No supporting evidence matches the selected filters.
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
                      <span className="block font-semibold">
                        {document.documentName ?? document.fileName}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {document.kind.replaceAll("_", " ")}
                        {document.documentName ? ` · ${document.fileName}` : ""} ·{" "}
                        {formatDate(document.createdAt)}
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
                      canDelete={canDeleteEvidence && registrationEvidenceEditable}
                      showLocked={canDeleteEvidence && !registrationEvidenceEditable}
                    />
                  </div>
                </details>
              ))}
              {evidenceTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  <p>
                    Page {evidencePage} of {evidenceTotalPages} · Showing{" "}
                    {visibleCompanyDocuments.length} of {filteredCompanyDocuments.length} evidence
                    documents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {evidencePage > 1 ? (
                      <Link
                        href={companyHref({
                          evidencePage: evidencePage - 1,
                        })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Previous
                      </Link>
                    ) : null}
                    {evidencePage < evidenceTotalPages ? (
                      <Link
                        href={companyHref({
                          evidencePage: evidencePage + 1,
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
        </details>

        {usesInAppRevenue ? <>
        <details className="group order-3 rounded-lg border border-zinc-200 bg-white p-5">
          <summary className="cursor-pointer list-none">
            <h2 className="text-xl font-semibold tracking-tight">Certificates</h2>
            <p className="mt-1 text-xs font-semibold text-[#800020] group-open:hidden">
              Expand card
            </p>
            <p className="mt-1 hidden text-xs font-semibold text-zinc-500 group-open:block">
              Collapse card
            </p>
          </summary>
          <p className="mt-4 border-t border-zinc-100 pt-4 text-sm leading-6 text-zinc-600">
            Issued annual compliance certificates are listed separately from supporting evidence.
          </p>
          <form className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <HiddenQueryInputs
              values={companyPageQuery}
              omit={["certificatePage", "certificateStatus", "certificateYear"]}
            />
            <label className="grid gap-1 text-xs font-medium text-zinc-700">
              Year
              <input
                name="certificateYear"
                type="number"
                defaultValue={certificateYear}
                className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-700">
              Status
              <select
                name="certificateStatus"
                defaultValue={certificateStatus ?? ""}
                className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Any status</option>
                {["ACTIVE", "REVOKED", "EXPIRED"].map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                Filter
              </button>
            </div>
            <FormActionProgress />
          </form>
          {certificateComplianceYears.length === 0 ? (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              No annual compliance certificate matches the selected filters.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {visibleCertificateComplianceYears.map((complianceYear) => (
                  <div
                    key={complianceYear.id}
                    className="rounded-md border border-zinc-100 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-950">
                          {complianceYear.year} compliance certificate
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {complianceYear.certificate?.certificateNumber} ·{" "}
                          {complianceYear.certificate?.status.replaceAll("_", " ")} · Issued{" "}
                          {formatDate(complianceYear.certificate?.issuedAt ?? null)}
                        </p>
                      </div>
                      {complianceYear.certificate?.generatedDocumentId ? (
                        <Link
                          href={`/registry/${company.id}/compliance/${complianceYear.id}/certificate/${complianceYear.certificate.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-9 items-center rounded-md bg-[#800020] px-3 text-xs font-semibold text-white"
                        >
                          View certificate
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-9 items-center rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-500">
                          PDF pending
                        </span>
                      )}
                    </div>
                  </div>
              ))}
              {certificateTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  <p>
                    Page {certificatePage} of {certificateTotalPages} · Showing{" "}
                    {visibleCertificateComplianceYears.length} of{" "}
                    {certificateComplianceYears.length} certificates
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {certificatePage > 1 ? (
                      <Link
                        href={companyHref({ certificatePage: certificatePage - 1 })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Previous
                      </Link>
                    ) : null}
                    {certificatePage < certificateTotalPages ? (
                      <Link
                        href={companyHref({ certificatePage: certificatePage + 1 })}
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
        </details>

        <details
          open={hasActionableComplianceYear}
          className="group order-1 rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2"
        >
          <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Compliance years</h2>
              <p className="mt-1 text-xs font-semibold text-[#800020] group-open:hidden">Expand card</p>
              <p className="mt-1 hidden text-xs font-semibold text-zinc-500 group-open:block">Collapse card</p>
            </div>
            {canCreateComplianceYear ? (
              <Link
                href={`/registry/${company.id}/compliance/new`}
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
              >
                Create year
              </Link>
            ) : isEmployerRole(activeRole) ? (
              <span className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-500">
                Registration required
              </span>
            ) : null}
          </summary>
          <form className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <HiddenQueryInputs
              values={companyPageQuery}
              omit={["compliancePage", "complianceStatus", "complianceYear"]}
            />
            <label className="grid gap-1 text-xs font-medium text-zinc-700">
              Year
              <input
                name="complianceYear"
                type="number"
                defaultValue={complianceYear}
                className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-700">
              Status
              <select
                name="complianceStatus"
                defaultValue={complianceStatus ?? ""}
                className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Any status</option>
                {[
                  "DRAFT",
                  "SUBMITTED",
                  "IN_REVIEW",
                  "CHANGES_REQUESTED",
                  "APPROVED",
                  "REJECTED",
                  "SETTLED",
                  "ARCHIVED",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                Filter
              </button>
            </div>
            <FormActionProgress />
          </form>
          {!canCreateComplianceYear && isEmployerRole(activeRole) ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Compliance year creation opens after ITF completes registration and assigns the ITF
              employer number.
            </p>
          ) : null}
          {filteredComplianceYears.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No annual compliance returns match the selected filters.
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
                              <FormActionProgress />
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
                      <HighlightedRemark>
                        {complianceYear.decisions[0].reason}
                      </HighlightedRemark>
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
                      <FormActionProgress />
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
                      <FormActionProgress />
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
                            canDelete={
                              canDeleteEvidence &&
                              isEvidenceWorkflowEditable([complianceYear.status])
                            }
                            showLocked={
                              canDeleteEvidence &&
                              !isEvidenceWorkflowEditable([complianceYear.status])
                            }
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
                    {visibleComplianceYears.length} of {filteredComplianceYears.length} compliance
                    year{filteredComplianceYears.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {compliancePage > 1 ? (
                      <Link
                        href={companyHref({
                          compliancePage: compliancePage - 1,
                        })}
                        className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                      >
                        Previous
                      </Link>
                    ) : null}
                    {compliancePage < complianceYearTotalPages ? (
                      <Link
                        href={companyHref({
                          compliancePage: compliancePage + 1,
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
        </details>
        </> : null}
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
            <FormActionProgress />
          </form>
        </section>
      ) : null}

    </div>
  );
}
