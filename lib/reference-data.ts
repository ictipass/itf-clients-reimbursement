import { cache } from "react";

import { getDb } from "@/lib/db";
import { listRoleManagementGroups } from "@/lib/role-management";
import type { Role } from "@/lib/rbac";
import { getVisibleWorkspaceApps } from "@/lib/workspace-apps";

export const listCachedActiveAreaOffices = cache(async () => {
  const db = getDb();

  return db.areaOffice.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
});

export const listCachedRoleManagementGroups = cache(async (requesterRole: Role) =>
  listRoleManagementGroups({ requesterRole }),
);

export const listCachedWorkspaceApps = cache(async (role: Role) => getVisibleWorkspaceApps(role));
