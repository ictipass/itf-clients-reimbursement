import { hash, verify } from "argon2";

import { writeAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/rbac";

export async function getUserProfile(email: string) {
  return getDb().user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true, phoneNumber: true, department: true, jobTitle: true, passwordHash: true, workflowEmailNotifications: true },
  });
}

export async function updateUserProfile(input: { email: string; name: string; phoneNumber?: string; workflowEmailNotifications: boolean }) {
  return getDb().user.update({
    where: { email: input.email.toLowerCase() },
    data: { name: input.name.trim(), phoneNumber: input.phoneNumber?.trim() || null, workflowEmailNotifications: input.workflowEmailNotifications },
  });
}

export async function changeUserPassword(input: {
  email: string;
  role: Role;
  currentPassword: string;
  newPassword: string;
}) {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true, email: true, passwordHash: true, memberships: { where: { isActive: true }, select: { workspaceId: true, organizationId: true }, take: 1 } },
  });
  if (!user?.passwordHash || !(await verify(user.passwordHash, input.currentPassword))) {
    throw new Error("Current password is incorrect.");
  }
  const passwordHash = await hash(input.newPassword, { type: 2, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  const membership = user.memberships[0];
  if (membership) await writeAuditEvent({
    action: "UPDATE",
    actor: { id: user.id, email: user.email, role: input.role },
    workspaceId: membership.workspaceId,
    organizationId: membership.organizationId ?? undefined,
    entityType: "User",
    entityId: user.id,
    reason: "User changed their portal password.",
  });
}
