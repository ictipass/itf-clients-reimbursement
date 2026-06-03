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
  DIRECTOR_FSD: ["registry:review", "claims:approve", "company:read", "audit:read"],
  HEAD_OF_DIVISION: [
    "numbers:manage",
    "registry:review",
    "claims:review",
    "claims:approve",
    "company:read",
    "audit:read",
  ],
  HQ_REIMBURSEMENT_OFFICER: ["claims:review", "company:read", "audit:read"],
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
    role === "HEAD_OF_DIVISION" ||
    role === "HQ_REIMBURSEMENT_OFFICER"
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
    role === "HQ_REIMBURSEMENT_OFFICER"
  );
}
