import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { downloadArchivedClaimEvidence } from "@/lib/evidence";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ claimId: string; documentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  const { claimId, documentId } = await context.params;
  try {
    const evidence = await downloadArchivedClaimEvidence({
      claimId, documentId, requesterEmail: session.user.email, requesterRole: session.user.role,
    });
    if (!evidence) return new Response("Archived evidence was not found or is not available to this officer.", { status: 404 });
    const inline = new URL(request.url).searchParams.get("disposition") === "inline" &&
      ["application/pdf", "image/jpeg", "image/png"].includes(evidence.mimeType);
    const fallback = evidence.fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "evidence";
    return new Response(evidence.stream, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(evidence.fileName)}`,
      "Content-Length": String(evidence.fileSize),
      "Content-Security-Policy": "sandbox",
      "Content-Type": evidence.mimeType,
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response("Archived evidence is temporarily unavailable. Contact the records administrator.", { status: 503 });
  }
}
