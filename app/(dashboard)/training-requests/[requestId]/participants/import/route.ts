import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import { importTrainingParticipants } from "@/lib/training-request";

export const dynamic = "force-dynamic";

function redirectToRequest(requestId: string, name: "message" | "error", message: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `/training-requests/${requestId}?${name}=${encodeURIComponent(message.slice(0, 220))}` },
  });
}

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  const { requestId } = await context.params;
  try {
    const formData = await request.formData();
    const count = await importTrainingParticipants({
      requestId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      file: await readUploadedFile(formData, "file", session.user.id),
    });
    return redirectToRequest(requestId, "message", `${count} participant${count === 1 ? "" : "s"} added.`);
  } catch (error) {
    return redirectToRequest(requestId, "error", error instanceof Error ? error.message : "Participant import failed.");
  }
}
