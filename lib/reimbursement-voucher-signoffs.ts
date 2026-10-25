import { assertClaimActionAssignee } from "@/lib/claim-officer-assignment";
import { getDb } from "@/lib/db";
import type { ReimbursementVoucherSignoffKind } from "@/lib/generated/prisma/client";
import type { Role } from "@/lib/rbac";

export const manualVoucherSignoffs = {
  PV_CHECKED: { role: "HEAD_REIMBURSEMENT_FINANCE", label: "Payment voucher checked" },
  BUDGET_CLEARED: { role: "BUDGET_OFFICER", label: "Budget clearance" },
  BUDGET_VERIFIED: { role: "HEAD_BUDGET", label: "Budget clearance verified" },
  PRE_AUDIT_CLEARED: { role: "PRE_AUDIT_OFFICER", label: "Payment-file pre-audit clearance" },
  PRE_AUDIT_VERIFIED: { role: "HEAD_PRE_AUDIT", label: "Payment-file pre-audit verified" },
} as const satisfies Partial<Record<ReimbursementVoucherSignoffKind, { role: Role; label: string }>>;

export type ManualVoucherSignoffKind = keyof typeof manualVoucherSignoffs;

export const voucherSignoffLabels: Record<ReimbursementVoucherSignoffKind, string> = {
  PAYMENT_APPROVED: "DG approval for payment",
  PV_PREPARED: "Payment voucher prepared",
  PV_CHECKED: "Payment voucher checked",
  BUDGET_CLEARED: "Budget clearance",
  BUDGET_VERIFIED: "Budget clearance verified",
  PRE_AUDIT_CLEARED: "Payment-file pre-audit clearance",
  PRE_AUDIT_VERIFIED: "Payment-file pre-audit verified",
  PAYMENT_RECORDED: "Payment recorded by Schedule Accountant",
};

export function isManualVoucherSignoffKind(value: string): value is ManualVoucherSignoffKind {
  return Object.hasOwn(manualVoucherSignoffs, value);
}

export function requiredVoucherSignoffForHandoff(from: string, to: string): ReimbursementVoucherSignoffKind | null {
  if (from === "HEAD_REIMBURSEMENT_FINANCE" && to === "HEAD_BUDGET") return "PV_CHECKED";
  if (from === "BUDGET_OFFICER" && to === "HEAD_BUDGET") return "BUDGET_CLEARED";
  if (from === "HEAD_BUDGET" && to === "DIRECTOR_AUDIT") return "BUDGET_VERIFIED";
  if (from === "PRE_AUDIT_OFFICER" && to === "HEAD_PRE_AUDIT") return "PRE_AUDIT_CLEARED";
  if (from === "HEAD_PRE_AUDIT" && to === "HEAD_REIMBURSEMENT_FINANCE") return "PRE_AUDIT_VERIFIED";
  return null;
}

export function canRecordVoucherSignoff(input: {
  kind: ManualVoucherSignoffKind;
  role: Role;
  desk: string;
  signoffRequired: boolean;
  signedKinds: readonly ReimbursementVoucherSignoffKind[];
  paymentVoucherRaised: boolean;
  paymentFileAuditStatus: string | null;
}) {
  if (!input.signoffRequired || input.role !== manualVoucherSignoffs[input.kind].role || input.desk !== input.role || input.signedKinds.includes(input.kind)) return false;
  const has = (kind: ReimbursementVoucherSignoffKind) => input.signedKinds.includes(kind);
  if (input.kind === "PV_CHECKED") return input.paymentVoucherRaised && has("PV_PREPARED");
  if (input.kind === "BUDGET_CLEARED") return has("PV_CHECKED");
  if (input.kind === "BUDGET_VERIFIED") return has("BUDGET_CLEARED");
  if (input.kind === "PRE_AUDIT_CLEARED") return has("BUDGET_VERIFIED") && input.paymentFileAuditStatus === "SUBMITTED";
  return has("PRE_AUDIT_CLEARED") && input.paymentFileAuditStatus === "VERIFIED";
}

export async function recordVoucherSignoff(input: {
  claimId: string;
  requesterEmail: string;
  requesterRole: Role;
  kind: ManualVoucherSignoffKind;
  remark: string;
}) {
  const remark = input.remark.trim();
  if (!remark) throw new Error("Record a remark explaining this clearance or verification.");
  const db = getDb();
  const actor = await db.user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, isActive: true, memberships: { where: { isActive: true }, select: { role: true, workspaceId: true } } },
  });
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: input.claimId, status: "SUBMITTED", recordTier: "HOT" },
    select: {
      id: true, companyId: true, currentDesk: true, voucherSignoffRequired: true,
      claimRecommendedAmount: true, paymentHandoffStatus: true,
      company: { select: { organization: { select: { workspaceId: true } } } },
      paymentFileAudit: { select: { status: true } },
      voucherSignoffs: { select: { kind: true } },
      decisions: { where: { reason: { startsWith: "Updated reimbursement payment handoff status to PV RAISED" } }, select: { id: true }, take: 1 },
    },
  });
  if (!claim || !actor?.isActive || !actor.memberships.some((membership) => membership.role === input.requesterRole && membership.workspaceId === claim.company.organization.workspaceId)) {
    throw new Error("You do not have access to sign this payment voucher.");
  }
  if (!canRecordVoucherSignoff({
    kind: input.kind, role: input.requesterRole, desk: claim.currentDesk,
    signoffRequired: claim.voucherSignoffRequired,
    signedKinds: claim.voucherSignoffs.map((signoff) => signoff.kind),
    paymentVoucherRaised: claim.paymentHandoffStatus === "PV_RAISED" || claim.decisions.length > 0,
    paymentFileAuditStatus: claim.paymentFileAudit?.status ?? null,
  })) throw new Error("This clearance is not available at the current desk or review stage.");
  if (!claim.claimRecommendedAmount || Number(claim.claimRecommendedAmount.toString()) <= 0) throw new Error("The approved amount is missing.");
  const approvedAmount = claim.claimRecommendedAmount;
  await assertClaimActionAssignee({ claimId: claim.id, requesterId: actor.id });
  return db.$transaction(async (tx) => {
    const stillAtDesk = await tx.reimbursementClaim.findFirst({
      where: { id: claim.id, status: "SUBMITTED", currentDesk: claim.currentDesk, voucherSignoffRequired: true },
      select: { id: true },
    });
    if (!stillAtDesk) throw new Error("This packet has moved. Reload the claim before signing.");
    const result = await tx.reimbursementVoucherSignoff.create({
      data: {
        reimbursementClaimId: claim.id, kind: input.kind, actorId: actor.id,
        actorRole: input.requesterRole, amount: approvedAmount, remark,
      },
    });
    await tx.decision.create({
      data: {
        actorId: actor.id, companyId: claim.companyId, reimbursementClaimId: claim.id,
        action: "APPROVE", reason: `${voucherSignoffLabels[input.kind]} electronically attested for NGN ${approvedAmount.toString()}. ${remark}`,
      },
    });
    return result;
  });
}
