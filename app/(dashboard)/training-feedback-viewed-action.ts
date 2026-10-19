"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function acknowledgeTrainingFeedbackViewed(
  target: "request" | "monitoring",
  targetId: string,
) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.email ||
    (session.user.role !== "EMPLOYER_ADMIN" && session.user.role !== "EMPLOYER_SUBMITTER")
  ) {
    return false;
  }

  const db = getDb();
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      memberships: {
        where: {
          isActive: true,
          role: { in: ["EMPLOYER_ADMIN", "EMPLOYER_SUBMITTER"] },
        },
        select: { organizationId: true },
      },
    },
  });
  const organizationIds = user?.memberships
    .map((membership) => membership.organizationId)
    .filter((id): id is string => Boolean(id)) ?? [];

  if (!user || organizationIds.length === 0) {
    return false;
  }

  const sourceKey = `training-${target}:${targetId}:employer-feedback`;
  const item = await db.workItem.findFirst({
    where: {
      sourceKey,
      app: "REIMBURSEMENT",
      kind: "TRAINING_FEEDBACK",
      status: "OPEN",
      recordTier: "HOT",
      assignedRole: "EMPLOYER_ADMIN",
      organizationId: { in: organizationIds },
    },
    select: { id: true, workspaceId: true, organizationId: true },
  });

  if (!item) {
    return false;
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.workItem.updateMany({
      where: { id: item.id, status: "OPEN", recordTier: "HOT" },
      data: { status: "ACKNOWLEDGED" },
    });

    if (updated.count === 0) {
      return false;
    }

    await tx.auditEvent.create({
      data: {
        workspaceId: item.workspaceId,
        organizationId: item.organizationId,
        actorId: user.id,
        action: "UPDATE",
        entityType: "WorkItem",
        entityId: item.id,
        metadata: { eventType: "EMPLOYER_FEEDBACK_VIEWED", target, targetId },
      },
    });

    return true;
  });
}
