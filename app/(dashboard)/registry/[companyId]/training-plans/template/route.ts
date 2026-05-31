import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getTrainingPlanCsvTemplate } from "@/lib/training-plan";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const csv = getTrainingPlanCsvTemplate();

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=\"training-plan-template.csv\"",
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
