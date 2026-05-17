export const roles = [
  "SYSTEM_ADMIN",
  "WORKSPACE_APP_ADMIN",
  "ITF_REGISTRATION_OFFICER",
  "ITF_COMPLIANCE_OFFICER",
  "ITF_TRAINING_APPROVER",
  "ITF_CLAIMS_REVIEWER",
  "ITF_CLAIMS_APPROVER",
  "ITF_AUDITOR",
  "EMPLOYER_ADMIN",
  "EMPLOYER_SUBMITTER",
  "EMPLOYER_VIEWER",
] as const;

export type Role = (typeof roles)[number];

export type Permission =
  | "workspace:manage"
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
  WORKSPACE_APP_ADMIN: ["workspace:manage", "audit:read", "company:read"],
  ITF_REGISTRATION_OFFICER: ["registry:review", "company:read", "audit:read"],
  ITF_COMPLIANCE_OFFICER: ["compliance:review", "company:read", "audit:read"],
  ITF_TRAINING_APPROVER: ["training:approve", "company:read", "audit:read"],
  ITF_CLAIMS_REVIEWER: ["claims:review", "company:read", "audit:read"],
  ITF_CLAIMS_APPROVER: ["claims:approve", "company:read", "audit:read"],
  ITF_AUDITOR: ["audit:read", "company:read"],
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

export function isItfRole(role: Role) {
  return role.startsWith("ITF_") || role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}
