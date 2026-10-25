import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";
import { can, isItfRole } from "@/lib/rbac";
import { buildPaymentVoucherPdf, canDownloadPaymentVoucher, paymentVoucherFilename } from "@/lib/reimbursement-payment-voucher";

export async function GET(_request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!isItfRole(session.user.role) || (!can(session.user.role, "claims:review") && !can(session.user.role, "claims:approve"))) {
    return Response.json({ error: "You do not have permission to view payment vouchers." }, { status: 403 });
  }
  const { claimId } = await params;
  const db = getDb();
  const visibilityWhere = await getClaimVisibilityWhere({ email: session.user.email, role: session.user.role });
  const claim = await db.reimbursementClaim.findFirst({
    where: { id: claimId, recordTier: "HOT", AND: [visibilityWhere] },
    select: {
      reference: true, claimYear: true, bankName: true, accountNumber: true,
      claimRecommendedAmount: true, claimRecommendedInWords: true,
      company: { select: { legalName: true, businessAddress: true } },
      voucherSignoffs: { select: { kind: true, signedAt: true, actor: { select: { name: true } } } },
      decisions: {
        where: { reason: { startsWith: "Updated reimbursement payment handoff status to PV RAISED" } },
        orderBy: { createdAt: "asc" }, take: 1,
        select: { createdAt: true, actorId: true, actor: { select: { name: true } } },
      },
      workItems: { where: { app: "REIMBURSEMENT", recordTier: "HOT" }, select: { assignedRole: true, updatedAt: true } },
    },
  });
  if (!claim) return Response.json({ error: "Claim not found." }, { status: 404 });
  const raised = claim.decisions[0];
  const requester = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!canDownloadPaymentVoucher({
    raisedAt: raised?.createdAt ?? null, raisedById: raised?.actorId ?? null, requesterId: requester?.id ?? null,
    requesterRole: session.user.role, deskAssignments: claim.workItems,
  })) return Response.json({ error: "The payment voucher is not available at your desk." }, { status: 403 });
  const pdf = await buildPaymentVoucherPdf(claim, raised.createdAt, raised.actor.name,
    claim.voucherSignoffs.map((signoff) => ({ kind: signoff.kind, officer: signoff.actor.name, signedAt: signoff.signedAt })));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${paymentVoucherFilename(claim)}"`,
      "Cache-Control": "no-store",
    },
  });
}
