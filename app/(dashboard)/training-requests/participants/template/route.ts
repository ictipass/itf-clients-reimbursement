import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { trainingParticipantWorkbookTemplate } from "@/lib/training-participant-import";
import { getTrainingAreas } from "@/lib/training-request";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  if (!can(session.user.role, "training:submit")) return new Response("Forbidden.", { status: 403 });
  const buffer = await trainingParticipantWorkbookTemplate(getTrainingAreas());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=training-participants-template.xlsx",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
