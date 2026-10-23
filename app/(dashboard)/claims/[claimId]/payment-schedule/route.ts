import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";
import {
  canDownloadEpaymentSchedule,
  buildReimbursementPaymentScheduleCsv,
  buildReimbursementPaymentScheduleFilename,
} from "@/lib/reimbursement-payment-schedule";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (
    session.user.role !== "SYSTEM_ADMIN" &&
    session.user.role !== "WORKSPACE_APP_ADMIN" &&
    !can(session.user.role, "claims:review") &&
    !can(session.user.role, "claims:approve")
  ) {
    return Response.json(
      { error: "You do not have permission to download payment schedules." },
      { status: 403 },
    );
  }

  const { claimId } = await params;
  const visibilityWhere = await getClaimVisibilityWhere({ email: session.user.email, role: session.user.role });
  const claim = await getDb().reimbursementClaim.findFirst({
    where: {
      id: claimId,
      recordTier: "HOT",
      AND: [visibilityWhere],
    },
    select: {
      reference: true,
      claimYear: true,
      itfReceiptNumber: true,
      bankName: true,
      accountNumber: true,
      sortCode: true,
      claimRecommendedAmount: true,
      claimRecommendedInWords: true,
      paymentScheduleReference: true,
      paymentScheduleExportedAt: true,
      paymentScheduleExportedById: true,
      paymentHandoffStatus: true,
      workItems: { where: { app: "REIMBURSEMENT", recordTier: "HOT" }, select: { assignedRole: true, updatedAt: true } },
      company: {
        select: {
          legalName: true,
          itfEmployerNumber: true,
          areaOffice: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!claim) {
    return Response.json({ error: "Reimbursement claim was not found." }, { status: 404 });
  }

  const requester = await getDb().user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!canDownloadEpaymentSchedule({
    exportedAt: claim.paymentScheduleExportedAt,
    exportedById: claim.paymentScheduleExportedById,
    reference: claim.paymentScheduleReference,
    requesterId: requester?.id ?? null,
    requesterRole: session.user.role,
    deskAssignments: claim.workItems,
  })) {
    return Response.json({ error: "The e-payment schedule has not been created for this desk." }, { status: 403 });
  }

  const csv = buildReimbursementPaymentScheduleCsv(claim);
  const filename = buildReimbursementPaymentScheduleFilename(claim);

  return new Response(new Blob([csv]).stream(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
