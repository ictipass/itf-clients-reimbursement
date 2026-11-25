import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canViewClaimAnalytics, ClaimAnalyticsAccessError } from "@/lib/claim-analytics";
import {
  buildClaimAnalyticsCsv,
  buildClaimAnalyticsWorkbook,
  claimAnalyticsFilterParams,
  ClaimAnalyticsExportTooLargeError,
  collectClaimAnalyticsExport,
  parseClaimAnalyticsFilters,
  recordClaimAnalyticsExport,
} from "@/lib/claim-analytics-report";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Authentication is required." }, { status: 401 });
  if (!canViewClaimAnalytics(session.user.role)) return Response.json({ error: "You do not have permission to export FSD analytics." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (format !== "csv" && format !== "xlsx") return Response.json({ error: "Choose CSV or Excel format." }, { status: 400 });
  let filters;
  try { filters = parseClaimAnalyticsFilters(claimAnalyticsFilterParams(params)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid report filters." }, { status: 400 }); }

  let report;
  try {
    report = await collectClaimAnalyticsExport({ requesterEmail: session.user.email, requesterRole: session.user.role, filters });
  } catch (error) {
    if (error instanceof ClaimAnalyticsExportTooLargeError) return Response.json({ error: error.message }, { status: 413 });
    if (error instanceof ClaimAnalyticsAccessError) {
      return Response.json({ error: "An active FSD role assignment is required." }, { status: 403 });
    }
    throw error;
  }

  const filename = `fsd-claim-analytics-${report.generatedAt.slice(0, 10)}-${report.reportId.slice(0, 8)}.${format}`;
  const body = format === "csv" ? new TextEncoder().encode(buildClaimAnalyticsCsv(report))
    : new Uint8Array(await buildClaimAnalyticsWorkbook(report));
  try { await recordClaimAnalyticsExport({ requesterEmail: session.user.email, requesterRole: session.user.role, filters }, report, format); }
  catch (error) {
    if (error instanceof ClaimAnalyticsAccessError) return Response.json({ error: error.message }, { status: 403 });
    throw error;
  }
  return new Response(new Blob([body]).stream(), {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
