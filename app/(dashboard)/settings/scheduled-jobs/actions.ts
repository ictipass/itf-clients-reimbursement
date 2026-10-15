"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { retryPendingAnnualEligibility } from "@/lib/annual-eligibility";
import { getDb } from "@/lib/db";
import { dispatchPendingWorkflowEmails } from "@/lib/workflow-email";

export async function runScheduledJobAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email || session.user.role !== "SYSTEM_ADMIN") {
    throw new Error("Only a system administrator may run scheduled jobs.");
  }
  const activeAdmin = await getDb().user.findFirst({
    where: { id: session.user.id, isActive: true, memberships: { some: { role: "SYSTEM_ADMIN", isActive: true } } },
    select: { id: true },
  });
  if (!activeAdmin) throw new Error("System administrator access is no longer active.");

  const job = formData.get("job");
  if (job !== "annual-eligibility" && job !== "workflow-notifications") {
    throw new Error("Unknown scheduled job.");
  }

  const result = job === "annual-eligibility"
    ? await retryPendingAnnualEligibility()
    : await dispatchPendingWorkflowEmails();

  const workspace = await getDb().workspace.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (workspace) {
    await writeAuditEvent({
      action: "UPDATE",
      actor: { id: session.user.id, email: session.user.email, role: session.user.role },
      workspaceId: workspace.id,
      entityType: "ScheduledJob",
      entityId: job,
      reason: "Manually initiated by system administrator.",
      metadata: job === "annual-eligibility"
        ? { checked: (result as Awaited<ReturnType<typeof retryPendingAnnualEligibility>>).length }
        : result as { processed: number; delivered: number },
    });
  }

  const message = job === "annual-eligibility"
    ? `Eligibility: checked ${(result as Awaited<ReturnType<typeof retryPendingAnnualEligibility>>).length} pending company/year records.`
    : `Workflow email: processed ${(result as Awaited<ReturnType<typeof dispatchPendingWorkflowEmails>>).processed} items; delivered ${(result as Awaited<ReturnType<typeof dispatchPendingWorkflowEmails>>).delivered} emails.`;
  redirect(`/settings/scheduled-jobs?result=${encodeURIComponent(message)}`);
}
