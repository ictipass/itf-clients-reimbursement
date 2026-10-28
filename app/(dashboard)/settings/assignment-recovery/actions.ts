"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { reassignClaimOfficer } from "@/lib/claim-officer-assignment";
import { getDb } from "@/lib/db";
import { getRecoveryAdmin, hasValidAssignment, recoveryTarget } from "@/lib/assignment-recovery";
import { reassignTrainingPlanReimbursementOfficer } from "@/lib/training-plan";
import { reassignTrainingRequestReimbursementOfficer } from "@/lib/training-request";

export async function recoverAssignmentAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const admin = await getRecoveryAdmin(session.user.email, session.user.role);
  if (!admin) throw new Error("Workspace administrator access is required.");
  const workItemId = String(formData.get("workItemId") ?? "");
  const assigneeUserId = String(formData.get("assigneeUserId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  let message = "Assignment recovered.";
  try {
    if (!reason) throw new Error("Enter a reason for reassignment.");
    const item = await getDb().workItem.findFirst({
      where: { id: workItemId, app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN", assignedUserId: { not: null }, workspaceId: { in: admin.memberships.map((membership) => membership.workspaceId) } },
      select: {
        id: true, assignedRole: true, assignedUserId: true, workspaceId: true, organizationId: true, areaOfficeId: true,
        trainingPlanSubmissionId: true, reimbursementClaimId: true, sourceKey: true,
        assignedUser: { select: { isActive: true, memberships: { select: { isActive: true, role: true, workspaceId: true, organizationId: true, areaOfficeId: true } } } },
      },
    });
    if (!item?.assignedUser || !item.assignedUserId) throw new Error("This named assignment is no longer open.");
    if (hasValidAssignment({
      userActive: item.assignedUser.isActive, role: item.assignedRole, workspaceId: item.workspaceId,
      organizationId: item.organizationId, areaOfficeId: item.areaOfficeId, memberships: item.assignedUser.memberships,
    })) throw new Error("This assignment is no longer stranded. Reload the list.");
    const target = recoveryTarget(item);
    if (!target) throw new Error("This assignment needs a workflow-specific recovery action.");
    if (target.kind === "claim") {
      await reassignClaimOfficer({ claimId: target.id, requesterId: admin.id, requesterRole: session.user.role, assigneeUserId, reason });
    } else if (target.kind === "plan") {
      await reassignTrainingPlanReimbursementOfficer({ submissionId: target.id, requesterEmail: session.user.email, requesterRole: session.user.role, assigneeUserId, reason });
    } else {
      await reassignTrainingRequestReimbursementOfficer({ requestId: target.id, requesterEmail: session.user.email, requesterRole: session.user.role, assigneeUserId, reason });
    }
  } catch (error) {
    message = error instanceof Error ? error.message : "The assignment could not be recovered.";
  }
  revalidatePath("/settings/assignment-recovery");
  redirect(`/settings/assignment-recovery?message=${encodeURIComponent(message.slice(0, 220))}`);
}
