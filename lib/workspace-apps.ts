import { can, type Role } from "@/lib/rbac";

export type WorkspaceAppDefinition = {
  key: string;
  name: string;
  description: string;
  href: string;
  status: "AVAILABLE" | "COMING_SOON";
  badgeModule?: string;
  isVisible: (role: Role) => boolean;
};

export const workspaceApps: WorkspaceAppDefinition[] = [
  {
    key: "reimbursement",
    name: "Contribution & Reimbursement",
    description: "Employer registration, compliance, training approvals, monitoring, and claims.",
    href: "/dashboard",
    status: "AVAILABLE",
    badgeModule: "reimbursement",
    isVisible: () => true,
  },
  {
    key: "learning",
    name: "Learning",
    description: "Future ITF learning and capacity development workspace.",
    href: "/dashboard",
    status: "COMING_SOON",
    isVisible: (role) => can(role, "training:approve") || can(role, "training:submit"),
  },
  {
    key: "finance",
    name: "Finance",
    description: "Future finance and payment operations workspace.",
    href: "/dashboard",
    status: "COMING_SOON",
    isVisible: (role) => can(role, "compliance:review") || can(role, "claims:approve"),
  },
];

export function getVisibleWorkspaceApps(role: Role) {
  return workspaceApps.filter((app) => app.isVisible(role));
}

export function getWorkspaceApp(key: string) {
  return workspaceApps.find((app) => app.key === key) ?? null;
}

export function getAvailableWorkspaceApps(role: Role) {
  return getVisibleWorkspaceApps(role).filter((app) => app.status === "AVAILABLE");
}
