import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { downloadCompanyEvidence } from "@/lib/evidence";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string) {
  const fallbackName = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "evidence";
  const encodedName = encodeURIComponent(fileName);

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/registry/[companyId]/evidence/[documentId]">,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const { companyId, documentId } = await context.params;

  try {
    const evidence = await downloadCompanyEvidence({
      companyId,
      documentId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
    });

    if (!evidence) {
      return new Response("Document was not found.", { status: 404 });
    }

    return new Response(new Uint8Array(evidence.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(evidence.fileName),
        "Content-Length": String(evidence.fileSize),
        "Content-Security-Policy": "sandbox",
        "Content-Type": evidence.mimeType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document download failed.";

    if (message.includes("will be implemented")) {
      return new Response(message, { status: 501 });
    }

    return new Response(message, { status: 403 });
  }
}
