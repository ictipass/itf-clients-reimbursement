import { can, getPermissions, roles, type Permission, type Role } from "@/lib/rbac";

export type RoleScope = "SYSTEM" | "HEADQUARTERS" | "AREA_OFFICE" | "EMPLOYER";

export type RoleDefinition = {
  role: Role;
  scope: RoleScope;
  title: string;
  description: string;
  permissions: Permission[];
  isSystemManaged: boolean;
};

const roleMetadata: Record<Role, Omit<RoleDefinition, "permissions" | "isSystemManaged">> = {
  SYSTEM_ADMIN: {
    role: "SYSTEM_ADMIN",
    scope: "SYSTEM",
    title: "System Administrator",
    description: "Full platform administration across workspace setup and workflow testing.",
  },
  WORKSPACE_APP_ADMIN: {
    role: "WORKSPACE_APP_ADMIN",
    scope: "SYSTEM",
    title: "Workspace App Administrator",
    description: "Manages reimbursement app setup, settings, users, offices, and audit access.",
  },
  ITF_REGISTRATION_OFFICER: {
    role: "ITF_REGISTRATION_OFFICER",
    scope: "HEADQUARTERS",
    title: "ITF Registration Officer",
    description: "Supports headquarters employer registration review activities.",
  },
  ITF_COMPLIANCE_OFFICER: {
    role: "ITF_COMPLIANCE_OFFICER",
    scope: "HEADQUARTERS",
    title: "ITF Compliance Officer",
    description: "Supports annual compliance review activities at headquarters.",
  },
  ITF_TRAINING_APPROVER: {
    role: "ITF_TRAINING_APPROVER",
    scope: "HEADQUARTERS",
    title: "ITF Training Approver",
    description: "Reviews and approves training-related workflow steps.",
  },
  ITF_CLAIMS_REVIEWER: {
    role: "ITF_CLAIMS_REVIEWER",
    scope: "HEADQUARTERS",
    title: "ITF Claims Reviewer",
    description: "Reviews reimbursement claim submissions and supporting evidence.",
  },
  ITF_CLAIMS_APPROVER: {
    role: "ITF_CLAIMS_APPROVER",
    scope: "HEADQUARTERS",
    title: "ITF Claims Approver",
    description: "Approves reimbursement claims at an authorized headquarters stage.",
  },
  ITF_AUDITOR: {
    role: "ITF_AUDITOR",
    scope: "HEADQUARTERS",
    title: "ITF Auditor",
    description: "Reads audit and company records for oversight and review.",
  },
  AREA_MANAGER: {
    role: "AREA_MANAGER",
    scope: "AREA_OFFICE",
    title: "Area Manager",
    description: "Area Office entry and exit point for registration and workflow correspondence.",
  },
  HORIC: {
    role: "HORIC",
    scope: "AREA_OFFICE",
    title: "Head of Revenue, Inspectorate & Compliance",
    description: "Area Office reviewer for registration and contribution recommendation routing.",
  },
  REVENUE_ACCOUNTANT: {
    role: "REVENUE_ACCOUNTANT",
    scope: "AREA_OFFICE",
    title: "Revenue Accountant",
    description: "Reviews employer submissions and recommends training contribution amounts.",
  },
  HEAD_OF_TRAINING: {
    role: "HEAD_OF_TRAINING",
    scope: "AREA_OFFICE",
    title: "Head of Training",
    description: "Area Office training and reimbursement workflow supervisor.",
  },
  REIMBURSEMENT_OFFICER: {
    role: "REIMBURSEMENT_OFFICER",
    scope: "AREA_OFFICE",
    title: "Reimbursement Officer",
    description: "Area Office officer for training approval and reimbursement claim review.",
  },
  DIRECTOR_FSD: {
    role: "DIRECTOR_FSD",
    scope: "HEADQUARTERS",
    title: "Director, Field Services Department",
    description: "Headquarters entry point for Field Services Department correspondence.",
  },
  HEAD_OF_DIVISION: {
    role: "HEAD_OF_DIVISION",
    scope: "HEADQUARTERS",
    title: "Head of Reimbursement Division",
    description: "Headquarters division lead for registration completion and claims routing.",
  },
  HQ_REIMBURSEMENT_OFFICER: {
    role: "HQ_REIMBURSEMENT_OFFICER",
    scope: "HEADQUARTERS",
    title: "HQ Reimbursement Officer",
    description: "Headquarters reimbursement officer for claim review and confirmation.",
  },
  HQ_REVENUE_ACCOUNTANT: {
    role: "HQ_REVENUE_ACCOUNTANT",
    scope: "HEADQUARTERS",
    title: "HQ Revenue Accountant",
    description: "Headquarters revenue accountant for annual compliance review and certification.",
  },
  DIRECTOR_GENERAL: {
    role: "DIRECTOR_GENERAL",
    scope: "HEADQUARTERS",
    title: "Director General",
    description: "National executive oversight across ITF reimbursement operations.",
  },
  DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE: {
    role: "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE",
    scope: "HEADQUARTERS",
    title: "Director, Revenue, Inspectorate & Compliance",
    description: "National oversight for revenue, inspectorate, and compliance operations.",
  },
  EMPLOYER_ADMIN: {
    role: "EMPLOYER_ADMIN",
    scope: "EMPLOYER",
    title: "Employer Administrator",
    description: "Employer-side administrator for company submissions and records.",
  },
  EMPLOYER_SUBMITTER: {
    role: "EMPLOYER_SUBMITTER",
    scope: "EMPLOYER",
    title: "Employer Submitter",
    description: "Employer-side user who can submit statutory and reimbursement workflow records.",
  },
  EMPLOYER_VIEWER: {
    role: "EMPLOYER_VIEWER",
    scope: "EMPLOYER",
    title: "Employer Viewer",
    description: "Employer-side read-only user for company records.",
  },
};

const roleScopeOrder: RoleScope[] = ["SYSTEM", "HEADQUARTERS", "AREA_OFFICE", "EMPLOYER"];

export function listRoleManagementGroups(input: { requesterRole: Role }) {
  if (!can(input.requesterRole, "workspace:manage")) {
    throw new Error("You do not have permission to manage roles.");
  }

  const definitions = roles.map((role) => ({
    ...roleMetadata[role],
    permissions: getPermissions(role),
    isSystemManaged: true,
  }));

  return roleScopeOrder.map((scope) => ({
    scope,
    title: formatRoleScope(scope),
    roles: definitions.filter((definition) => definition.scope === scope),
  }));
}

export function formatPermission(permission: Permission) {
  return permission.replace(":", ": ");
}

function formatRoleScope(scope: RoleScope) {
  return scope.replaceAll("_", " ");
}
