import type { Permission, Role } from "@/lib/rbac";

export const appName = "ITF Reimbursement Gateway";

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
  { label: "RBAC roles", value: "11", detail: "ITF and employer boundaries" },
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
