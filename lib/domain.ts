import type { Permission, Role } from "@/lib/rbac";

export const appName = "ITF Integrated Contribution and Reimbursement Platform";

export const workflowStages = [
  {
    key: "registry",
    title: "Employer Registry",
    status: "Foundation ready",
    owner: "Registration officers",
    description: "Company profile, CAC/TCC/audit evidence, Form 7A, ITF employer number.",
    permissions: ["registry:submit", "registry:review"] satisfies Permission[],
  },
  {
    key: "compliance",
    title: "Annual Compliance",
    status: "Schema drafted",
    owner: "Compliance officers",
    description: "Contribution payment, L&D policy, training policy, annual plan, deadline controls.",
    permissions: ["compliance:submit", "compliance:review"] satisfies Permission[],
  },
  {
    key: "training",
    title: "Training Approval",
    status: "Schema drafted",
    owner: "Training approvers",
    description: "Form 4A, providers, venues, participants, estimated cost, reviewer decisions.",
    permissions: ["training:submit", "training:approve"] satisfies Permission[],
  },
  {
    key: "claims",
    title: "Reimbursement Claims",
    status: "Schema drafted",
    owner: "Claims desk",
    description: "Claim package, forms, receipts, attendance, reports, certificates, approval trail.",
    permissions: ["claims:submit", "claims:review", "claims:approve"] satisfies Permission[],
  },
];

export const dashboardMetrics = [
  { label: "Domain models", value: "12", detail: "Workspace through audit events" },
  { label: "RBAC roles", value: "19", detail: "ITF, area office, HQ, and employer boundaries" },
  { label: "Document kinds", value: "21", detail: "Registration, compliance, claim evidence" },
  { label: "Workflow states", value: "8", detail: "Draft through archive" },
];

export const seedRoles: { role: Role; scope: string; purpose: string }[] = [
  {
    role: "SYSTEM_ADMIN",
    scope: "Platform",
    purpose: "Bootstrap configuration, emergency access, and root governance.",
  },
  {
    role: "ITF_REGISTRATION_OFFICER",
    scope: "ITF",
    purpose: "Review employer identity, registration evidence, and activation state.",
  },
  {
    role: "AREA_MANAGER",
    scope: "Area Office",
    purpose: "Entry and exit point for area office registration, training, and claims workflows.",
  },
  {
    role: "HORIC",
    scope: "Area Office",
    purpose: "Review registration and compliance submissions before revenue recommendation.",
  },
  {
    role: "REVENUE_ACCOUNTANT",
    scope: "Area Office",
    purpose: "Assess and recommend training contribution payable by employers.",
  },
  {
    role: "HEAD_OF_TRAINING",
    scope: "Area Office",
    purpose: "Coordinate training approval, mid-submission, and claims review routing.",
  },
  {
    role: "REIMBURSEMENT_OFFICER",
    scope: "Area Office",
    purpose: "Review training approval, monitoring, and reimbursement documents.",
  },
  {
    role: "DIRECTOR_FSD",
    scope: "Headquarters",
    purpose: "Route and approve Headquarters reimbursement claims.",
  },
  {
    role: "HEAD_OF_DIVISION",
    scope: "Headquarters",
    purpose: "Coordinate Headquarters Reimbursement Division claims review and recommendations.",
  },
  {
    role: "HQ_REIMBURSEMENT_OFFICER",
    scope: "Headquarters",
    purpose: "Review headquarters reimbursement submissions and award recommendations.",
  },
  {
    role: "HQ_REVENUE_ACCOUNTANT",
    scope: "Headquarters",
    purpose: "Complete employer registration and review annual compliance returns.",
  },
  {
    role: "HEAD_INSPECTORATE_COMPLIANCE",
    scope: "Headquarters",
    purpose: "Route employer registrations and oversee annual compliance review.",
  },
  {
    role: "ITF_COMPLIANCE_OFFICER",
    scope: "ITF",
    purpose: "Review annual contribution and statutory compliance evidence.",
  },
  {
    role: "ITF_CLAIMS_APPROVER",
    scope: "ITF",
    purpose: "Approve reimbursement recommendations and final claim decisions.",
  },
  {
    role: "EMPLOYER_ADMIN",
    scope: "Company",
    purpose: "Manage company profile, submissions, and employer-side access.",
  },
];
