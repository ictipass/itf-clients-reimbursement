import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canBrowseArchivedClaims, getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";
import { buildArchivedTrainingPlanPdf, parseArchivedPaymentPacket } from "@/lib/reimbursement-archive-packet";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ claimId: string; submissionId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  if (!canBrowseArchivedClaims(session.user.role)) return new Response("Archived training plans are restricted to authorized staff.", { status: 403 });
  const { claimId, submissionId } = await context.params;
  const visibility = await getClaimVisibilityWhere({ email: session.user.email, role: session.user.role });
  const claim = await getDb().reimbursementClaim.findFirst({
    where: { id: claimId, status: "ARCHIVED", recordTier: "HOT", AND: [visibility] },
    select: { archiveSnapshot: true },
  });
  const packet = parseArchivedPaymentPacket(claim?.archiveSnapshot);
  const plan = packet?.trainingPlans?.find((item) => item.id === submissionId);
  if (!packet || !plan) return new Response("Archived training plan was not found.", { status: 404 });
  const pdf = await buildArchivedTrainingPlanPdf(packet, plan);
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="archived-training-plan-${plan.year}.pdf"`,
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
  } });
}
