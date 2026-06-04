import { can, type Permission, type Role } from "@/lib/rbac";

export type FeatureGate = {
  key: string;
  label: string;
  routePrefix: string;
  permissions: Permission[];
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
    key: "settings",
    label: "Settings",
    routePrefix: "/settings",
    permissions: ["workspace:manage", "numbers:manage"],
  },
];

export function canUseFeature(role: Role, gate: FeatureGate) {
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
  const gate = getFeatureGateForPath(pathname);

  return !gate || canUseFeature(role, gate);
}
