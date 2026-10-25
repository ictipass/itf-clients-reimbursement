import { getDb } from "@/lib/db";
import { getClaimWorkflowTransitions } from "@/lib/claims";
import type { Role } from "@/lib/rbac";

export const individuallyAssignedClaimRoles = [
  "REIMBURSEMENT_OFFICER",
  "HQ_REIMBURSEMENT_OFFICER",
  "REIMBURSEMENT_SCHEDULE_AUDITOR",
  "REIMBURSEMENT_ACCOUNTANT",
  "BUDGET_OFFICER",
  "PRE_AUDIT_OFFICER",
  "EXPENDITURE_ACCOUNTANT",
  "PAYMENT_INITIATOR",
] as const satisfies readonly Role[];

export type IndividuallyAssignedClaimRole = (typeof individuallyAssignedClaimRoles)[number];

export function isIndividuallyAssignedClaimRole(role: string): role is IndividuallyAssignedClaimRole {
  return individuallyAssignedClaimRoles.includes(role as IndividuallyAssignedClaimRole);
}

export function isClaimAssignedToAnotherOfficer(assignedUserId: string | null, requesterId: string | null) {
  return Boolean(assignedUserId && assignedUserId !== requesterId);
}

export async function listAssignableClaimOfficers(input: {
  role: IndividuallyAssignedClaimRole;
  workspaceId: string;
  areaOfficeId: string | null;
}) {
  if (input.role === "REIMBURSEMENT_OFFICER" && !input.areaOfficeId) return [];
  return getDb().user.findMany({
    where: {
      isActive: true,
      memberships: { some: {
        isActive: true,
        role: input.role,
        workspaceId: input.workspaceId,
        ...(input.role === "REIMBURSEMENT_OFFICER" ? { areaOfficeId: input.areaOfficeId } : {}),
      } },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export function resolveClaimOfficerAssignment(
  officers: readonly { id: string }[],
  requestedId: string | undefined,
) {
  if (!officers.length) throw new Error("No active officer is assigned to the destination role. Configure an officer before forwarding this packet.");
  if (!requestedId && officers.length > 1) throw new Error("Select the officer who will receive this claim packet.");
  const assignee = officers.find((officer) => officer.id === (requestedId ?? officers[0].id));
  if (!assignee) throw new Error("The selected officer is not active in the destination role and jurisdiction.");
  return assignee.id;
}

export function claimAssignmentRoutingReasons(role: IndividuallyAssignedClaimRole) {
  return getClaimWorkflowTransitions().filter((transition) => transition.to === role).map((transition) => transition.reason);
}

export async function getClaimAssignmentSenderId(claimId: string, role: IndividuallyAssignedClaimRole) {
  const reasons = claimAssignmentRoutingReasons(role);
  const decision = await getDb().decision.findFirst({
    where: { reimbursementClaimId: claimId, recordTier: "HOT", OR: reasons.map((reason) => ({ reason: { startsWith: reason } })) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { actorId: true },
  });
  return decision?.actorId ?? null;
}

export async function assertClaimActionAssignee(input: { claimId: string; requesterId: string }) {
  const claim = await getDb().reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT" },
    select: {
      currentDesk: true,
      workItems: { where: { app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN" }, select: { assignedRole: true, assignedUserId: true } },
    },
  });
  if (!claim || !isIndividuallyAssignedClaimRole(claim.currentDesk)) return;
  const workItem = claim.workItems.find((item) => item.assignedRole === claim.currentDesk);
  if (isClaimAssignedToAnotherOfficer(workItem?.assignedUserId ?? null, input.requesterId)) {
    throw new Error("This packet is assigned to another officer. You may view it, but only its assigned officer may change or forward it.");
  }
}

export async function reassignClaimOfficer(input: {
  claimId: string;
  requesterId: string;
  requesterRole: Role;
  assigneeUserId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Record a reason for reassigning this claim packet.");
  const db = getDb();
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, recordTier: "HOT", status: "SUBMITTED" },
    select: { id: true, companyId: true, currentDesk: true, company: { select: { areaOfficeId: true, organization: { select: { workspaceId: true } } } } },
  });
  if (!claim || !isIndividuallyAssignedClaimRole(claim.currentDesk)) throw new Error("This claim is not at an individually assigned officer desk.");
  const senderId = await getClaimAssignmentSenderId(claim.id, claim.currentDesk);
  if (senderId !== input.requesterId) {
    if (input.requesterRole !== "SYSTEM_ADMIN" && input.requesterRole !== "WORKSPACE_APP_ADMIN") {
      throw new Error("Only the officer who forwarded this packet may reassign it.");
    }
    const admin = await db.user.findFirst({
      where: { id: input.requesterId, isActive: true, memberships: { some: { isActive: true, role: input.requesterRole, workspaceId: claim.company.organization.workspaceId } } },
      select: { id: true },
    });
    if (!admin) throw new Error("You do not have administrative authority in this claim's workspace.");
  }
  const workItem = await db.workItem.findFirst({
    where: { reimbursementClaimId: claim.id, assignedRole: claim.currentDesk, app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN" },
    select: { id: true, assignedUserId: true },
  });
  if (!workItem) throw new Error("The current officer assignment is no longer open.");
  const officers = await listAssignableClaimOfficers({
    role: claim.currentDesk, workspaceId: claim.company.organization.workspaceId, areaOfficeId: claim.company.areaOfficeId,
  });
  const assigneeId = resolveClaimOfficerAssignment(officers, input.assigneeUserId);
  if (assigneeId === workItem.assignedUserId) throw new Error("Select a different officer for reassignment.");
  const assignee = officers.find((officer) => officer.id === assigneeId)!;
  await db.$transaction(async (tx) => {
    const result = await tx.workItem.updateMany({
      where: { id: workItem.id, status: "OPEN", assignedUserId: workItem.assignedUserId },
      data: { assignedUserId: assigneeId, emailNotifiedAt: null },
    });
    if (result.count !== 1) throw new Error("This packet was reassigned by someone else. Reload and try again.");
    await tx.decision.create({
      data: {
        actorId: input.requesterId, companyId: claim.companyId, reimbursementClaimId: claim.id,
        action: "FORWARD", reason: `Reassigned ${claim.currentDesk.replaceAll("_", " ")} packet to ${assignee.name} (${assignee.email}). Reason: ${reason}`,
      },
    });
  });
}
