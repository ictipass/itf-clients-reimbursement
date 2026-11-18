import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { claimStaffWorkbookTemplate } from "@/lib/claim-staff-import";
import { can } from "@/lib/rbac";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  if (!can(session.user.role, "claims:submit")) return new Response("Forbidden.", { status: 403 });
  return new Response(new Uint8Array(await claimStaffWorkbookTemplate()), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=claim-staff-list-template.xlsx",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
