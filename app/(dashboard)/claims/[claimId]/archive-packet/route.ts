import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";
import { buildArchivedPaymentPacketPdf, parseArchivedPaymentPacket } from "@/lib/reimbursement-archive-packet";
import { buildPaymentVoucherPdf } from "@/lib/reimbursement-payment-voucher";
import { isItfRole } from "@/lib/rbac";

export async function GET(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!isItfRole(session.user.role)) return Response.json({ error: "Archived payment packets are restricted to ITF staff." }, { status: 403 });
  const { claimId } = await params;
  const visibility = await getClaimVisibilityWhere({ email: session.user.email, role: session.user.role });
  const claim = await getDb().reimbursementClaim.findFirst({
    where: { id: claimId, recordTier: "HOT", status: "ARCHIVED", AND: [visibility] },
    select: { archiveSnapshot: true, companyId: true },
  });
  if (!claim) return Response.json({ error: "Archived packet was not found." }, { status: 404 });
  const packet = parseArchivedPaymentPacket(claim.archiveSnapshot);
  if (!packet) return Response.json({ error: "The archive snapshot is unavailable." }, { status: 409 });
  const voucher = packet.voucherRaised && packet.voucherPreparedBy ? await buildPaymentVoucherPdf({
    reference: packet.reference, claimYear: packet.claimYear,
    bankName: packet.bankName, accountNumber: packet.accountNumber,
    claimRecommendedAmount: packet.approvedAmount, claimRecommendedInWords: packet.amountInWords,
    company: { legalName: packet.companyName, businessAddress: packet.companyAddress },
  }, new Date(packet.voucherRaised), packet.voucherPreparedBy,
  packet.signoffs.map((signoff) => ({ kind: signoff.kind, officer: signoff.officer, signedAt: new Date(signoff.signedAt) }))) : undefined;
  const pdf = await buildArchivedPaymentPacketPdf(packet,
    `${new URL(request.url).origin}/registry/${encodeURIComponent(claim.companyId)}/evidence`, voucher);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="archived-payment-packet-${packet.reference.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
