import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolvePaystackAccount } from "@/lib/paystack-account";
import { assertRateLimit } from "@/lib/rate-limit";
import { can, isItfRole } from "@/lib/rbac";

export async function POST(request: Request, context: { params: Promise<{ claimId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!can(session.user.role, "claims:submit") || isItfRole(session.user.role)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const { claimId } = await context.params;
  const claim = await getDb().reimbursementClaim.findFirst({
    where: { id: claimId, status: "DRAFT", recordTier: "HOT", company: { isActive: true, recordTier: "HOT" } },
    select: { company: { select: { organizationId: true, organization: { select: { workspaceId: true } } } } },
  });
  if (!claim) return Response.json({ error: "Editable claim was not found." }, { status: 404 });
  const member = await getDb().user.findFirst({
    where: { email: session.user.email, isActive: true, memberships: { some: { organizationId: claim.company.organizationId, isActive: true } } },
    select: { id: true },
  });
  if (!member) return Response.json({ error: "You do not have access to this claim." }, { status: 403 });
  try {
    await assertRateLimit({ key: `account-resolve:${session.user.email.toLowerCase()}`, limit: 10, windowMs: 10 * 60 * 1000 });
    if (Number(request.headers.get("content-length") ?? 0) > 2048) throw new Error("Invalid account verification request.");
    const body = await request.json() as { bankId?: unknown; accountNumber?: unknown };
    if (typeof body.bankId !== "string" || typeof body.accountNumber !== "string") throw new Error("Select a bank and enter an account number.");
    const bank = await getDb().bankDirectoryEntry.findFirst({
      where: { id: body.bankId, workspaceId: claim.company.organization.workspaceId, isActive: true },
      select: { paystackCode: true },
    });
    if (!bank) throw new Error("Select an active bank from the accepted bank list.");
    const accountName = await resolvePaystackAccount(body.accountNumber, bank.paystackCode);
    return Response.json({ accountName }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Account verification failed." }, { status: 400 });
  }
}
