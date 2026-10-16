import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { officeWorkbookTemplate } from "@/lib/office-import";
import { can } from "@/lib/rbac";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  if (!can(session.user.role, "workspace:manage")) return new Response("Forbidden.", { status: 403 });
  const buffer = await officeWorkbookTemplate();
  return new Response(new Uint8Array(buffer), { headers: {
    "Cache-Control": "private, no-store",
    "Content-Disposition": "attachment; filename=area-offices-template.xlsx",
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "X-Content-Type-Options": "nosniff",
  } });
}
