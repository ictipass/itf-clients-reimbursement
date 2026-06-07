import { can, isItfRole, type Role } from "@/lib/rbac";

export type NavItem = {
  href: string;
  label: string;
  module: string;
  isVisible: (role: Role) => boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type VisibleNavGroup = {
  label: string;
  items: Array<Omit<NavItem, "isVisible">>;
};

const canUseRegistry = (role: Role) =>
  can(role, "company:read") || can(role, "registry:review") || can(role, "registry:submit");

const canUseCompliance = (role: Role) =>
  can(role, "compliance:review") || can(role, "compliance:submit");

const canUseTrainingPlans = (role: Role) =>
  can(role, "training:submit") || can(role, "training:approve");

const canUseClaims = (role: Role) =>
  can(role, "claims:review") || can(role, "claims:approve") || can(role, "claims:submit");

const canUseManagement = (role: Role) =>
  isItfRole(role) && (can(role, "workspace:manage") || can(role, "audit:read"));

const canUseSettings = (role: Role) => can(role, "workspace:manage");
const canUseNumbers = (role: Role) => can(role, "numbers:manage");
const canManageEmployerUsers = (role: Role) => role === "EMPLOYER_ADMIN";

export const navGroups: NavGroup[] = [
  {
    label: "Desk",
    items: [{ href: "/dashboard", label: "Overview", module: "dashboard", isVisible: () => true }],
  },
  {
    label: "Employer lifecycle",
    items: [
      { href: "/registry", label: "Registry", module: "registry", isVisible: canUseRegistry },
      {
        href: "/compliance",
        label: "Compliance",
        module: "compliance",
        isVisible: canUseCompliance,
      },
    ],
  },
  {
    label: "Training",
    items: [
      {
        href: "/training-plans",
        label: "Training Plans",
        module: "training",
        isVisible: canUseTrainingPlans,
      },
      {
        href: "/training-requests",
        label: "Training Requests",
        module: "training",
        isVisible: canUseTrainingPlans,
      },
      {
        href: "/training-monitoring",
        label: "Monitoring",
        module: "training",
        isVisible: canUseTrainingPlans,
      },
    ],
  },
  {
    label: "Reimbursement",
    items: [{ href: "/claims", label: "Claims", module: "claims", isVisible: canUseClaims }],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/employer/users",
        label: "Organization users",
        module: "settings",
        isVisible: canManageEmployerUsers,
      },
      {
        href: "/management",
        label: "Management",
        module: "management",
        isVisible: canUseManagement,
      },
      { href: "/settings/audit", label: "Audit log", module: "settings", isVisible: (role) => can(role, "audit:read") },
      { href: "/settings/users", label: "Users", module: "settings", isVisible: canUseSettings },
      {
        href: "/settings/employers",
        label: "Employer access",
        module: "settings",
        isVisible: canUseSettings,
      },
      {
        href: "/settings/offices",
        label: "Offices",
        module: "settings",
        isVisible: canUseSettings,
      },
      { href: "/settings/roles", label: "Roles", module: "settings", isVisible: canUseSettings },
      { href: "/settings/numbers", label: "Numbers", module: "settings", isVisible: canUseNumbers },
      {
        href: "/settings/certificates",
        label: "Certificates",
        module: "settings",
        isVisible: canUseSettings,
      },
      {
        href: "/settings/signatures",
        label: "Signatures",
        module: "settings",
        isVisible: canUseSettings,
      },
    ],
  },
];

export function getVisibleNavGroups(role: Role) {
  return navGroups
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => item.isVisible(role))
        .map(({ href, label, module }) => ({ href, label, module })),
    }))
    .filter((group) => group.items.length > 0);
}
