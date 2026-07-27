export const roles = [
  "SYSTEM_ADMIN",
  "WORKSPACE_APP_ADMIN",
  "ITF_REGISTRATION_OFFICER",
  "ITF_COMPLIANCE_OFFICER",
  "ITF_TRAINING_APPROVER",
  "ITF_CLAIMS_REVIEWER",
  "ITF_CLAIMS_APPROVER",
  "ITF_AUDITOR",
  "AREA_MANAGER",
  "HORIC",
  "REVENUE_ACCOUNTANT",
  "HEAD_OF_TRAINING",
  "REIMBURSEMENT_OFFICER",
  "DIRECTOR_FSD",
  "HEAD_OF_DIVISION",
  "HQ_REIMBURSEMENT_OFFICER",
  "HQ_REVENUE_ACCOUNTANT",
  "DIRECTOR_GENERAL",
  "DIRECTOR_AUDIT",
  "HEAD_REIMBURSEMENT_AUDIT",
  "REIMBURSEMENT_SCHEDULE_AUDITOR",
  "HEAD_BUDGET",
  "BUDGET_OFFICER",
  "PRE_AUDIT_OFFICER",
  "DIRECTOR_FINANCE",
  "HEAD_REIMBURSEMENT_FINANCE",
  "REIMBURSEMENT_ACCOUNTANT",
  "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE",
  "HEAD_INSPECTORATE_COMPLIANCE",
  "EMPLOYER_ADMIN",
  "EMPLOYER_SUBMITTER",
  "EMPLOYER_VIEWER",
] as const;

export type Role = (typeof roles)[number];

export type Permission =
  | "workspace:manage"
  | "numbers:manage"
  | "registry:review"
  | "registry:submit"
  | "compliance:review"
  | "compliance:submit"
  | "training:approve"
  | "training:submit"
  | "claims:review"
  | "claims:approve"
  | "claims:submit"
  | "audit:read"
  | "company:manage"
  | "company:read";

const permissionsByRole: Record<Role, Permission[]> = {
  SYSTEM_ADMIN: [
    "workspace:manage",
    "numbers:manage",
    "registry:review",
    "registry:submit",
    "compliance:review",
    "compliance:submit",
    "training:approve",
    "training:submit",
    "claims:review",
    "claims:approve",
    "claims:submit",
    "audit:read",
    "company:manage",
    "company:read",
  ],
  WORKSPACE_APP_ADMIN: ["workspace:manage", "numbers:manage", "audit:read", "company:read"],
  ITF_REGISTRATION_OFFICER: ["registry:review", "company:read", "audit:read"],
  ITF_COMPLIANCE_OFFICER: ["compliance:review", "company:read", "audit:read"],
  ITF_TRAINING_APPROVER: ["training:approve", "company:read", "audit:read"],
  ITF_CLAIMS_REVIEWER: ["claims:review", "company:read", "audit:read"],
  ITF_CLAIMS_APPROVER: ["claims:approve", "company:read", "audit:read"],
  ITF_AUDITOR: ["audit:read", "company:read"],
  AREA_MANAGER: [
    "registry:review",
    "compliance:review",
    "training:approve",
    "claims:review",
    "company:read",
    "audit:read",
  ],
  HORIC: ["registry:review", "compliance:review", "company:read", "audit:read"],
  REVENUE_ACCOUNTANT: ["registry:review", "compliance:review", "company:read", "audit:read"],
  HEAD_OF_TRAINING: ["training:approve", "claims:review", "company:read", "audit:read"],
  REIMBURSEMENT_OFFICER: ["training:approve", "claims:review", "company:read", "audit:read"],
  DIRECTOR_FSD: ["claims:approve", "company:read", "audit:read"],
  HEAD_OF_DIVISION: ["claims:review", "claims:approve", "company:read", "audit:read"],
  HQ_REIMBURSEMENT_OFFICER: ["claims:review", "company:read", "audit:read"],
  HQ_REVENUE_ACCOUNTANT: [
    "numbers:manage",
    "registry:review",
    "compliance:review",
    "company:read",
    "audit:read",
  ],
  DIRECTOR_GENERAL: ["registry:review", "compliance:review", "training:approve", "claims:approve", "company:read", "audit:read"],
  DIRECTOR_AUDIT: ["claims:approve", "company:read", "audit:read"],
  HEAD_REIMBURSEMENT_AUDIT: ["claims:review", "claims:approve", "company:read", "audit:read"],
  REIMBURSEMENT_SCHEDULE_AUDITOR: ["claims:review", "company:read", "audit:read"],
  HEAD_BUDGET: ["claims:review", "claims:approve", "company:read", "audit:read"],
  BUDGET_OFFICER: ["claims:review", "company:read", "audit:read"],
  PRE_AUDIT_OFFICER: ["claims:review", "company:read", "audit:read"],
  DIRECTOR_FINANCE: ["claims:approve", "company:read", "audit:read"],
  HEAD_REIMBURSEMENT_FINANCE: ["claims:review", "claims:approve", "company:read", "audit:read"],
  REIMBURSEMENT_ACCOUNTANT: ["claims:review", "company:read", "audit:read"],
  DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE: [
    "registry:review",
    "compliance:review",
    "company:read",
    "audit:read",
  ],
  HEAD_INSPECTORATE_COMPLIANCE: [
    "numbers:manage",
    "registry:review",
    "compliance:review",
    "company:read",
    "audit:read",
  ],
  EMPLOYER_ADMIN: [
    "registry:submit",
    "compliance:submit",
    "training:submit",
    "claims:submit",
    "company:manage",
    "company:read",
  ],
  EMPLOYER_SUBMITTER: [
    "registry:submit",
    "compliance:submit",
    "training:submit",
    "claims:submit",
    "company:read",
  ],
  EMPLOYER_VIEWER: ["company:read"],
};

export function getPermissions(role: Role) {
  return permissionsByRole[role];
}

export function can(role: Role, permission: Permission) {
  return permissionsByRole[role].includes(permission);
}

export function canManageAnnualCompliance(role: Role) {
  return (
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    role === "HEAD_INSPECTORATE_COMPLIANCE" ||
    role === "HQ_REVENUE_ACCOUNTANT"
    || role === "DIRECTOR_GENERAL"
    || role === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE"
  );
}

export function canManageClaimPolicy(role: Role) {
  return (
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    role === "DIRECTOR_FSD" ||
    role === "HEAD_OF_DIVISION"
  );
}

export function isItfRole(role: Role) {
  return (
    role.startsWith("ITF_") ||
    role === "SYSTEM_ADMIN" ||
    role === "WORKSPACE_APP_ADMIN" ||
    role === "AREA_MANAGER" ||
    role === "HORIC" ||
    role === "REVENUE_ACCOUNTANT" ||
    role === "HEAD_OF_TRAINING" ||
    role === "REIMBURSEMENT_OFFICER" ||
    role === "DIRECTOR_FSD" ||
    role === "HEAD_OF_DIVISION" ||
    role === "HQ_REIMBURSEMENT_OFFICER" ||
    role === "HQ_REVENUE_ACCOUNTANT"
    || role === "DIRECTOR_AUDIT"
    || role === "HEAD_REIMBURSEMENT_AUDIT"
    || role === "REIMBURSEMENT_SCHEDULE_AUDITOR"
    || role === "HEAD_BUDGET"
    || role === "BUDGET_OFFICER"
    || role === "PRE_AUDIT_OFFICER"
    || role === "DIRECTOR_FINANCE"
    || role === "HEAD_REIMBURSEMENT_FINANCE"
    || role === "REIMBURSEMENT_ACCOUNTANT"
    || role === "DIRECTOR_GENERAL"
    || role === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE"
    || role === "HEAD_INSPECTORATE_COMPLIANCE"
  );
}
