import { retryPendingAnnualEligibility } from "@/lib/annual-eligibility";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await retryPendingAnnualEligibility();
  return Response.json({ checked: results.length, results });
}
