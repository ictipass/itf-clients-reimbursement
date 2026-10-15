import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { downloadCompanyEvidence } from "@/lib/evidence";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string, disposition: "attachment" | "inline") {
  const fallbackName = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "evidence";
  const encodedName = encodeURIComponent(fileName);

  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

function resolveDisposition(request: Request, mimeType: string) {
  const url = new URL(request.url);
  const requestedDisposition = url.searchParams.get("disposition");
  const inlineSafeMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

  if (requestedDisposition === "inline" && inlineSafeMimeTypes.has(mimeType)) {
    return "inline";
  }

  return "attachment";
}

export async function GET(
  request: Request,
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

    const disposition = resolveDisposition(request, evidence.mimeType);

    return new Response(evidence.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(evidence.fileName, disposition),
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
