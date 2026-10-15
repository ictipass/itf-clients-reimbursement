import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "Not found" }, { status: 404 });
  const secret = process.env.ELIGIBILITY_DEV_API_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("health") === "1") {
    await getDb().workspace.count({ where: { isActive: true } });
    return Response.json({ available: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const itfEmployerNumber = url.searchParams.get("itfEmployerNumber")?.trim();
  const workspaceId = url.searchParams.get("workspaceId")?.trim();
  const year = Number(url.searchParams.get("year"));
  if (!workspaceId || !itfEmployerNumber || itfEmployerNumber.length > 80 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return Response.json({ error: "Workspace, ITF number, and year are required." }, { status: 400 });
  }
  const record = await getDb().developmentEligibilityRecord.findFirst({
    where: { workspaceId, itfEmployerNumber, year, workspace: { isActive: true } },
  });
  return Response.json({
    itfEmployerNumber,
    year,
    paymentSettled: record?.paymentSettled ?? false,
    contributionPaid: record?.contributionPaid.toString() ?? "0",
    certificateIssued: record?.certificateIssued ?? false,
    certificateNumber: record?.certificateNumber ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}
