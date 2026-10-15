import { retryPendingAnnualEligibility } from "@/lib/annual-eligibility";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SCHEDULED_JOBS_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "Scheduled jobs are disabled." });
  }
  const results = await retryPendingAnnualEligibility();
  return Response.json({ checked: results.length, results });
}
