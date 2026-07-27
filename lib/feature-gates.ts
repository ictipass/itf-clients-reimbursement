import { can, canManageClaimPolicy, type Permission, type Role } from "@/lib/rbac";

export type FeatureGate = {
  key: string;
  label: string;
  routePrefix: string;
  permissions: Permission[];
};

export type SectionGateKey =
  | "claim.form.edit"
  | "claim.evidence.upload"
  | "claim.recommendation.edit"
  | "claim.calculation.edit";

const sectionGates: Record<SectionGateKey, Permission[]> = {
  "claim.form.edit": ["claims:submit"],
  "claim.evidence.upload": ["claims:submit", "claims:review"],
  "claim.recommendation.edit": ["claims:review"],
  "claim.calculation.edit": ["claims:submit", "claims:review"],
};

export const featureGates: FeatureGate[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    routePrefix: "/dashboard",
    permissions: [],
  },
  {
    key: "registry",
    label: "Registry",
    routePrefix: "/registry",
    permissions: ["company:read", "registry:review", "registry:submit"],
  },
  {
    key: "compliance",
    label: "Compliance",
    routePrefix: "/compliance",
    permissions: ["compliance:review", "compliance:submit"],
  },
  {
    key: "training",
    label: "Training",
    routePrefix: "/training",
    permissions: ["training:approve", "training:submit"],
  },
  {
    key: "claims",
    label: "Claims",
    routePrefix: "/claims",
    permissions: ["claims:review", "claims:approve", "claims:submit"],
  },
  {
    key: "management",
    label: "Management",
    routePrefix: "/management",
    permissions: ["audit:read", "workspace:manage"],
  },
  {
    key: "employer-users",
    label: "Organization users",
    routePrefix: "/employer/users",
    permissions: ["company:manage"],
  },
  {
    key: "settings-audit",
    label: "Audit log",
    routePrefix: "/settings/audit",
    permissions: ["audit:read"],
  },
  {
    key: "settings-numbers",
    label: "Number registry",
    routePrefix: "/settings/numbers",
    permissions: ["numbers:manage"],
  },
  {
    key: "settings-system",
    label: "System settings",
    routePrefix: "/settings/system",
    permissions: ["workspace:manage"],
  },
  {
    key: "settings-operating-model",
    label: "Contribution operating model",
    routePrefix: "/settings/operating-model",
    permissions: [],
  },
  {
    key: "settings-claims",
    label: "Claim settings",
    routePrefix: "/settings/claims",
    permissions: [],
  },
  {
    key: "settings-preferences",
    label: "Personal settings",
    routePrefix: "/settings/preferences",
    permissions: [],
  },
  {
    key: "settings-workspace",
    label: "Workspace settings",
    routePrefix: "/settings",
    permissions: ["workspace:manage"],
  },
];

export function canUseFeature(role: Role, gate: FeatureGate) {
  if (gate.key === "settings-claims" || gate.key === "settings-operating-model") {
    return canManageClaimPolicy(role);
  }

  return gate.permissions.length === 0 || gate.permissions.some((permission) => can(role, permission));
}

export function getFeatureGateForPath(pathname: string) {
  return (
    featureGates
      .filter((gate) => pathname === gate.routePrefix || pathname.startsWith(`${gate.routePrefix}/`))
      .sort((left, right) => right.routePrefix.length - left.routePrefix.length)[0] ?? null
  );
}

export function canAccessPath(role: Role, pathname: string) {
  if (pathname === "/settings") {
    return true;
  }

  const gate = getFeatureGateForPath(pathname);

  return !gate || canUseFeature(role, gate);
}

export function canUseSection(role: Role, key: SectionGateKey) {
  return sectionGates[key].some((permission) => can(role, permission));
}
