import { dispatchPendingWorkflowEmails } from "@/lib/workflow-email";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SCHEDULED_JOBS_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "Scheduled jobs are disabled." });
  }
  return Response.json(await dispatchPendingWorkflowEmails());
}
