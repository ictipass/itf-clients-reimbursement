import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getUserCsvTemplate } from "@/lib/user-directory";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  if (!can(session.user.role, "workspace:manage")) {
    return new Response("You do not have permission to download user templates.", { status: 403 });
  }

  return new Response(getUserCsvTemplate(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=\"user-directory-template.csv\"",
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
