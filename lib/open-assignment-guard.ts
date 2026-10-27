import { getDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Role } from "@/lib/rbac";

type AssignmentReader = Pick<Prisma.TransactionClient, "workItem">;

export async function assertNoOpenAssignedWork(input: {
  userId: string;
  role?: Role;
  workspaceId?: string;
  organizationId?: string;
  areaOfficeId?: string | null;
  db?: AssignmentReader;
}) {
  const db = input.db ?? getDb();
  const item = await db.workItem.findFirst({
    where: {
      assignedUserId: input.userId,
      status: "OPEN",
      recordTier: "HOT",
      ...(input.role ? { assignedRole: input.role } : {}),
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.areaOfficeId !== undefined ? { areaOfficeId: input.areaOfficeId } : {}),
    },
    select: { id: true, title: true, targetHref: true },
  });
  if (item) {
    throw new Error(`This user has an open assigned job (${item.title}). Reassign it at ${item.targetHref} before removing their access.`);
  }
}
